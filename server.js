// MealSnap × 카카오 챗봇 PoC 서버 (독립 실행 · DB 없음)
//
// 목적: "냉장고와 연결되면 이렇게 쓸 수 있다"를 보여주는 데모용 최소 서버.
// 실제 MealSnap 백엔드(bee0 내부, 외부 접근 불가)를 그대로 노출하는 대신,
// 유통기한 지난 식재료를 "그럴듯한 고정 목업"으로 응답한다.
// 카카오 응답 스키마/쿠팡 링크 로직은 본 서버(backend/src/services/kakaoService.js)와 동일하게 맞췄다.

const express = require('express');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public')); // 정적 이미지 서빙

// 요청 헤더 디버그
app.use((req, _res, next) => {
	console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
	if (req.method === 'POST' && req.url === '/api/kakao/webhook') {
		console.log(`  protocol=${req.protocol}, host=${req.get('host')}, x-forwarded-proto=${req.get('x-forwarded-proto')}, x-forwarded-host=${req.get('x-forwarded-host')}`);
	}
	next();
});

const PORT = process.env.PORT || 4000; // Render 는 PORT 를 주입한다. 로컬: 4000


// ── 그럴듯한 고정 목업: 유통기한 지난 식재료 (오늘 기준 과거 날짜) ──
// days_overdue = 며칠 지났는지(양수). 실제 앱에선 DB의 expiry_date 로 계산되지만 여기선 고정.

// 상태별 이미지 URL (static 파일)
const getImageUrl = (req, filename) => {
	// Render의 X-Forwarded-* 헤더 우선, 없으면 직접 요청 정보 사용
	const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
	const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
	const url = `${protocol}://${host}/${filename}`;
	console.log(`[getImageUrl] filename=${filename}, url=${url}`);
	return url;
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
	{ label: '가전제어', action: 'message', messageText: '가전제어' },
];

// 가전 기기 목록
const APPLIANCES = [
	{ id: 'air_purifier', name: '공기청정기', icon: '💨', color: '#4ECDC4', status: 'on' },
	{ id: 'robot_vacuum', name: '로봇청소기', icon: '🤖', color: '#45B7D1', status: 'on' },
	{ id: 'air_conditioner', name: '에어컨', icon: '❄️', color: '#96CEB4', status: 'on' },
	{ id: 'washer', name: '세탁기', icon: '🌊', color: '#FFEAA7', status: 'off' },
	{ id: 'tv', name: 'TV', icon: '📺', color: '#DDA0DD', status: 'on' },
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
				imageUrl: getImageUrl(req, 'expired.png'),
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
				imageUrl: getImageUrl(req, 'approaching.png'),
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
				imageUrl: getImageUrl(req, 'fresh.png'),
			})),
		});
	}

	return { version: '2.0', template: { outputs: [{ carousel: { type: 'listCard', items: carouselItems } }], quickReplies: QUICK_REPLIES } };
}

// 가전 제어 응답 생성 (basicCard 캐루셀)
function buildApplianceResponse(req) {
	const carouselItems = APPLIANCES.map(appliance => ({
		title: `${appliance.icon} ${appliance.name}`,
		description: `상태: ${appliance.status === 'on' ? '🟢 켜짐' : '🔴 꺼짐'}`,
		thumbnail: {
			imageUrl: getImageUrl(req, `appliance_${appliance.id}.png`)
		},
		buttons: [
			{
				action: 'message',
				label: '🟢 켜기',
				messageText: `${appliance.name} 켜줘`
			},
			{
				action: 'message',
				label: '❓ 상태',
				messageText: `${appliance.name} 상태`
			},
			{
				action: 'message',
				label: '🔴 끄기',
				messageText: `${appliance.name} 꺼줘`
			}
		]
	}));

	return {
		version: '2.0',
		template: {
			outputs: [
				{
					carousel: {
						type: 'basicCard',
						items: carouselItems
					}
				}
			]
		}
	};
}

function parseIntent(body) {
	const utterance = (body && body.userRequest && body.userRequest.utterance) || '';
	console.log(`[parseIntent] utterance="${utterance}" (length=${utterance.length})`);

	// 가전 제어 intent 확인
	const isAppliance = /가전|제어|공기청정|청소기|에어컨|세탁|TV/.test(utterance);
	console.log(`[parseIntent] isAppliance=${isAppliance}`);
	if (isAppliance) {
		console.log(`[parseIntent] ✅ Matched appliance keywords`);
		return 'appliance';
	}

	// 재구매 intent 확인
	const isRebuy = /재구매|구매|장보기|주문|쿠팡/.test(utterance);
	console.log(`[parseIntent] isRebuy=${isRebuy}`);
	if (isRebuy) {
		console.log(`[parseIntent] ✅ Matched rebuy keywords`);
		return 'rebuy';
	}

	console.log(`[parseIntent] → default to fridge`);
	return 'fridge';
}

// 카카오 스킬 webhook (실제 백엔드와 동일 경로)
app.post('/api/kakao/webhook', (req, res) => {
	try {
		console.log('🔔 [WEBHOOK] 요청 받음!');
		console.log('[webhook] full request body=', JSON.stringify(req.body, null, 2));

		const utterance =
			(req.body && req.body.userRequest && req.body.userRequest.utterance) || '(none)';

		console.log(
			'[webhook] utterance=',
			JSON.stringify(utterance)
		);

		const intent = parseIntent(req.body);
		let response;
		if (intent === 'rebuy') {
			response = buildRebuyResponse(req);
		} else if (intent === 'appliance') {
			response = buildApplianceResponse(req);
		} else {
			response = buildFridgeResponse(req);
		}

		console.log(
			'[webhook] intent=',
			intent,
			'-> outputs=',
			response.template.outputs.map((o) => Object.keys(o)[0]).join(',')
		);

		// 첫 번째 이미지 URL만 로그
		const firstImageUrl = response.template?.outputs?.[0]?.carousel?.items?.[0]?.items?.[0]?.imageUrl
			|| response.template?.outputs?.[0]?.listCard?.items?.[0]?.imageUrl
			|| 'N/A';
		console.log('✅ [webhook] RESPONSE 이미지 URL:', firstImageUrl);

		console.log('\n==================== 📤 최종 응답 ====================');
		console.log(JSON.stringify(response, null, 2));
		console.log('===================================================\n');

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


// 루트 안내 (브라우저로 열었을 때)
app.get('/', (_req, res) => {
	res.type('text/plain').send('MealSnap x Kakao PoC server. POST /api/kakao/webhook');
});

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Kakao PoC server running on http://0.0.0.0:${PORT}`);
});
