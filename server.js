// MealSnap × 카카오 챗봇 PoC 서버 (독립 실행 · DB 없음)
//
// 목적: "냉장고와 연결되면 이렇게 쓸 수 있다"를 보여주는 데모용 최소 서버.
// 실제 MealSnap 백엔드(bee0 내부, 외부 접근 불가)를 그대로 노출하는 대신,
// 유통기한 지난 식재료를 "그럴듯한 고정 목업"으로 응답한다.
// 카카오 응답 스키마/쿠팡 링크 로직은 본 서버(backend/src/services/kakaoService.js)와 동일하게 맞췄다.

const express = require('express');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => { console.log(`${new Date().toISOString()} ${req.method} ${req.url}`); next(); });

const PORT = process.env.PORT || 3000; // Render 는 PORT 를 주입한다.

// ── 그럴듯한 고정 목업: 유통기한 지난 식재료 (오늘 기준 과거 날짜) ──
// days_overdue = 며칠 지났는지(양수). 실제 앱에선 DB의 expiry_date 로 계산되지만 여기선 고정.
const EXPIRED_ITEMS = [
	{ name: '시금치', days_overdue: 5, expiry_date: '2026-07-01', imageUrl: 'https://via.placeholder.com/100/90EE90/000000?text=시금치' },
	{ name: '닭가슴살', days_overdue: 4, expiry_date: '2026-07-02', imageUrl: 'https://via.placeholder.com/100/FFB6C1/000000?text=닭가슴살' },
	{ name: '우유', days_overdue: 3, expiry_date: '2026-07-03', imageUrl: 'https://via.placeholder.com/100/FFFACD/000000?text=우유' },
	{ name: '두부', days_overdue: 2, expiry_date: '2026-07-04', imageUrl: 'https://via.placeholder.com/100/D3D3D3/000000?text=두부' },
	{ name: '계란', days_overdue: 1, expiry_date: '2026-07-05', imageUrl: 'https://via.placeholder.com/100/FFD700/000000?text=계란' },
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
function expiredListCard(items, headerTitle) {
	const shown = items.slice(0, MAX_LIST_ITEMS);
	return {
		listCard: {
			header: { title: headerTitle },
			items: shown.map((it) => ({
				title: it.name,
				description: `${it.days_overdue}일 지남 (${it.expiry_date})`,
				thumbnail: { imageUrl: it.imageUrl },
				link: { web: coupangUrl(it.name) },
			})),
		},
	};
}

// [재료 재구매] 만료 항목 → 쿠팡 링크
function buildRebuyResponse() {
	if (EXPIRED_ITEMS.length === 0) {
		return wrap([{ simpleText: { text: '재구매가 필요한(유통기한 지난) 재료가 없습니다' } }]);
	}
	return wrap([expiredListCard(EXPIRED_ITEMS, '재구매가 필요한 재료')]);
}

// [냉장고 관리] 만료 항목을 carousel 로 반환.
function buildFridgeResponse() {
	const total = EXPIRED_ITEMS.length + FRESH_ITEMS.length;

	if (EXPIRED_ITEMS.length === 0) {
		// 만료 항목이 없으면 신선 목록을 보여준다.
		return wrap([{
			listCard: {
				header: { title: `냉장고 재료 ${total}개 모두 신선` },
				items: FRESH_ITEMS.slice(0, MAX_LIST_ITEMS).map((it) => ({
					title: it.name,
					description: `${it.status} ${it.detail}`,
				})),
			},
		}]);
	}

	return wrap([expiredListCard(EXPIRED_ITEMS, '만료 항목')]);
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
		const response = intent === 'rebuy' ? buildRebuyResponse() : buildFridgeResponse();

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

// 루트 안내 (브라우저로 열었을 때)
app.get('/', (_req, res) => {
	res.type('text/plain').send('MealSnap x Kakao PoC server. POST /api/kakao/webhook');
});

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Kakao PoC server running on http://0.0.0.0:${PORT}`);
});
