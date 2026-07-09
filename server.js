// MealSnap × 카카오 챗봇 PoC 서버 (독립 실행 · DB 없음)
//
// 목적: "냉장고와 연결되면 이렇게 쓸 수 있다"를 보여주는 데모용 최소 서버.
// 실제 MealSnap 백엔드(bee0 내부, 외부 접근 불가)를 그대로 노출하는 대신,
// 유통기한 지난 식재료를 "그럴듯한 고정 목업"으로 응답한다.
// 카카오 응답 스키마/쿠팡 링크 로직은 본 서버(backend/src/services/kakaoService.js)와 동일하게 맞췄다.

const express = require('express');
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public')); // 정적 이미지 서빙
app.use((req, _res, next) => { console.log(`${new Date().toISOString()} ${req.method} ${req.url}`); next(); });

const PORT = process.env.PORT || 3000; // Render 는 PORT 를 주입한다.

// ── 서버 시작 시 이미지 생성 ──
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
	fs.mkdirSync(publicDir);
}

const generateImage = (filename, bgColor, text, textColor = '#fff') => {
	const canvas = createCanvas(200, 200);
	const ctx = canvas.getContext('2d');

	// 배경
	ctx.fillStyle = bgColor;
	ctx.fillRect(0, 0, 200, 200);

	// 동그란 배경
	ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
	ctx.beginPath();
	ctx.arc(100, 100, 80, 0, Math.PI * 2);
	ctx.fill();

	// 텍스트
	ctx.fillStyle = textColor;
	ctx.font = 'bold 36px Arial';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, 100, 100);

	const buffer = canvas.toBuffer('image/png');
	fs.writeFileSync(path.join(publicDir, filename), buffer);
	console.log(`✓ 이미지 생성: ${filename}`);
};

// 시작 시 이미지 생성
generateImage('expired.png', '#E63946', '만료', '#fff');
generateImage('approaching.png', '#F1FAEE', '임박', '#E63946');
generateImage('fresh.png', '#A8DADC', '신선', '#1D3557');

// ── 그럴듯한 고정 목업: 유통기한 지난 식재료 (오늘 기준 과거 날짜) ──
// days_overdue = 며칠 지났는지(양수). 실제 앱에선 DB의 expiry_date 로 계산되지만 여기선 고정.

// 상태별 이미지 URL (동적 생성 엔드포인트)
const getImageUrl = (req, status) => {
	const protocol = req.protocol || 'http';
	const host = req.get('host') || `localhost:${PORT}`;
	return `${protocol}://${host}/api/image/${status}`;
};

const EXPIRED_ITEMS = [
	{ name: '시금치', days_overdue: 5, expiry_date: '2026-07-01' },
	{ name: '닭가슴살', days_overdue: 4, expiry_date: '2026-07-02' },
	{ name: '우유', days_overdue: 3, expiry_date: '2026-07-03' },
	{ name: '두부', days_overdue: 2, expiry_date: '2026-07-04' },
	{ name: '계란', days_overdue: 1, expiry_date: '2026-07-05' },
];

// 냉장고 전체 재료(만료 제외) 목업 — '냉장고 관리'에서 요약 표시용
const FRESH_ITEMS = [
	{ name: '양파', status: '신선', detail: '12일 남음' },
	{ name: '당근', status: '신선', detail: '9일 남음' },
	{ name: '고추장', status: '신선', detail: '40일 남음' },
	{ name: '간장', status: '신선', detail: '120일 남음' },
	{ name: '대파', status: '임박', detail: '2일 남음' },
];

const MAX_LIST_ITEMS = 4; // 카카오 listCard 최대 5행

const COUPANG_SEARCH_BASE = 'https://www.coupang.com/np/search';
function coupangUrl(productName) {
	return `${COUPANG_SEARCH_BASE}?q=${encodeURIComponent(productName || '')}`;
}

const QUICK_REPLIES = [
	{ label: '냉장고 관리', action: 'message', messageText: '냉장고관리' },
	{ label: '재료 재구매', action: 'message', messageText: '재료 재구매' },
];

function wrap(outputs) {
	return { version: '2.0', template: { outputs, quickReplies: QUICK_REPLIES } };
}

// 만료 항목 → 쿠팡 재구매 링크가 달린 listCard (이미지 포함)
function expiredListCard(items, headerTitle, req) {
	const shown = items.slice(0, MAX_LIST_ITEMS);
	return {
		listCard: {
			header: { title: headerTitle },
			items: shown.map((it) => ({
				title: it.name,
				description: `${it.days_overdue}일 지남 (${it.expiry_date})`,
				imageUrl: getImageUrl(req, 'expired'),
				link: { web: coupangUrl(it.name) },
			})),
		},
	};
}

// [재료 재구매] 만료 항목 → 쿠팡 링크
function buildRebuyResponse(req) {
	if (EXPIRED_ITEMS.length === 0) {
		return wrap([{ simpleText: { text: '재구매가 필요한(유통기한 지난) 재료가 없습니다' } }]);
	}
	return wrap([expiredListCard(EXPIRED_ITEMS, '재구매가 필요한 재료', req)]);
}

// [냉장고 관리] carousel 안에 만료/임박/신선 카테고리별 listCard.
function buildFridgeResponse(req) {
	const approaching = FRESH_ITEMS.filter((i) => i.status === '임박');
	const fresh = FRESH_ITEMS.filter((i) => i.status === '신선');

	const carouselItems = [];

	// 1. 만료 항목
	carouselItems.push({
		header: { title: `만료 항목 (${EXPIRED_ITEMS.length}개)` },
		items: EXPIRED_ITEMS.slice(0, MAX_LIST_ITEMS).map((it) => ({
			title: it.name,
			description: `${it.days_overdue}일 지남 (${it.expiry_date})`,
			imageUrl: getImageUrl(req, 'expired'),
			link: { web: coupangUrl(it.name) },
		})),
	});

	// 2. 임박 항목
	if (approaching.length > 0) {
		carouselItems.push({
			header: { title: `임박 항목 (${approaching.length}개)` },
			items: approaching.slice(0, MAX_LIST_ITEMS).map((it) => ({
				title: it.name,
				description: `${it.detail}`,
				imageUrl: getImageUrl(req, 'approaching'),
			})),
		});
	}

	// 3. 신선 항목
	if (fresh.length > 0) {
		carouselItems.push({
			header: { title: `신선 항목 (${fresh.length}개)` },
			items: fresh.slice(0, MAX_LIST_ITEMS).map((it) => ({
				title: it.name,
				description: `${it.detail}`,
				imageUrl: getImageUrl(req, 'fresh'),
			})),
		});
	}

	return { version: '2.0', template: { outputs: [{ carousel: { type: 'listCard', items: carouselItems } }], quickReplies: QUICK_REPLIES } };
}

function parseIntent(body) {
	const utterance = (body && body.userRequest && body.userRequest.utterance) || '';
	if (/재구매|구매|장보기|주문|쿠팡/.test(utterance)) return 'rebuy';
	return 'fridge';
}

// 카카오 스킬 webhook (실제 백엔드와 동일 경로)
app.post('/api/kakao/webhook', (req, res) => {
	try {
		console.log('[webhook] full request body=', JSON.stringify(req.body, null, 2));

		const utterance =
			(req.body && req.body.userRequest && req.body.userRequest.utterance) || '(none)';

		console.log(
			'[webhook] utterance=',
			JSON.stringify(utterance)
		);

		const intent = parseIntent(req.body);
		const response = intent === 'rebuy' ? buildRebuyResponse(req) : buildFridgeResponse(req);

		console.log(
			'[webhook] intent=',
			intent,
			'-> outputs=',
			response.template.outputs.map((o) => Object.keys(o)[0]).join(',')
		);

		// 응답 전체 로그
		console.log('[webhook] response=', JSON.stringify(response, null, 2));

		res.json(response);
	} catch (err) {
		console.error('webhook error:', err);

		const errorResponse = wrap([
			{
				simpleText: {
					text: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
				}
			}
		]);

		// 에러 응답도 로그
		console.log('[webhook] error response=', JSON.stringify(errorResponse, null, 2));

		res.json(errorResponse);
	}
});

// 헬스 체크 (Render/카카오 확인용)
app.get('/api/health', (_req, res) => {
	res.json({ success: true, data: { status: 'ok', poc: true, timestamp: new Date().toISOString() } });
});

// ── 동적 이미지 엔드포인트 (재구매/만료=red, 임박=yellow, 신선=green) ──
app.get('/api/image/:status', (req, res) => {
	const { status } = req.params;

	const config = {
		expired: { bgColor: '#E63946', text: '만료', textColor: '#fff' },
		approaching: { bgColor: '#FFD93D', text: '임박', textColor: '#000' },
		fresh: { bgColor: '#6BCB77', text: '신선', textColor: '#fff' },
	};

	const cfg = config[status];
	if (!cfg) {
		return res.status(400).json({ error: 'Invalid status' });
	}

	const canvas = createCanvas(200, 200);
	const ctx = canvas.getContext('2d');

	// 배경
	ctx.fillStyle = cfg.bgColor;
	ctx.fillRect(0, 0, 200, 200);

	// 동그란 배경
	ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
	ctx.beginPath();
	ctx.arc(100, 100, 80, 0, Math.PI * 2);
	ctx.fill();

	// 텍스트
	ctx.fillStyle = cfg.textColor;
	ctx.font = 'bold 36px Arial';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(cfg.text, 100, 100);

	res.type('image/png');
	res.send(canvas.toBuffer('image/png'));
});

// 루트 안내 (브라우저로 열었을 때)
app.get('/', (_req, res) => {
	res.type('text/plain').send('MealSnap x Kakao PoC server. POST /api/kakao/webhook');
});

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Kakao PoC server running on http://0.0.0.0:${PORT}`);
});
