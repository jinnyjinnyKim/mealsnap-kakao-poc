// "크리스마스 영화 추천해줘" → TV A2UI 응답을 카카오 챗봇 스킬 응답으로 옮겨본 PoC (독립 서버, 기존 server.js 와 무관)
//
// A2UI(TV) 구성                    →  카카오 매핑
//  - 헤드라인 + 요약 문구            →  말풍선 1: simpleText
//  - 영화 카드 4장(포스터/태그/제목)  →  말풍선 2: carousel(basicCard)
//  - 추천 질문 chip 3개              →  말풍선 3: simpleText + quickReplies
//
// 실행: node server.js (PORT 기본 4100)   POST /api/kakao/christmas-movies

const express = require('express');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname + '/public'));

const PORT = process.env.PORT || 4100;

const MOVIES = [
	{ id: 'gospel', title: '크리스마스 가스펠', tag: '따뜻한 음악과 가족' },
	{ id: 'intern', title: '인턴', tag: '마음 따뜻한 인생 영화' },
	{ id: 'cinema', title: '시네마 천국', tag: '클래식 명작의 감동' },
	{ id: 'scrooge', title: '스크루지: 크리스마스 캐럴', tag: '기묘한 성탄절 판타지' },
];

const CHIPS = [
	{ label: '"크리스마스 가스펠 상세 정보 보여줘"', messageText: '크리스마스 가스펠 상세 정보 보여줘' },
	{ label: '"나 홀로 집에 틀어줘"', messageText: '나 홀로 집에 틀어줘' },
	{ label: '"인기 영화 추천해 줘"', messageText: '인기 영화 추천해 줘' },
];

function baseUrl(req) {
	const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
	const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
	return `${proto}://${host}`;
}

function buildResponse(req) {
	const base = baseUrl(req);
	return {
		version: '2.0',
		template: {
			outputs: [
				{
					simpleText: {
						text:
							'크리스마스에 보기 좋은 따뜻한 영화를 추천해 드려요.\n\n' +
							'크리스마스 가스펠, 인턴, 시네마 천국, 스크루지: 크리스마스 캐럴을 추천해 드립니다.',
					},
				},
				{
					carousel: {
						type: 'basicCard',
						items: MOVIES.map((m) => ({
							title: m.title,
							description: m.tag,
							thumbnail: { imageUrl: `${base}/poster_${m.id}.png` },
							buttons: [
								{
									action: 'webLink',
									label: '상세 정보',
									webLinkUrl: `https://search.naver.com/search.naver?query=${encodeURIComponent(m.title + ' 영화')}`,
								},
							],
						})),
					},
				},
				{ simpleText: { text: '이런 것도 물어보세요 👇' } },
			],
			quickReplies: CHIPS.map((c) => ({ label: c.label, action: 'message', messageText: c.messageText })),
		},
	};
}

// 발화와 무관하게 항상 같은 응답 (PoC)
app.post('/api/kakao/christmas-movies', (req, res) => {
	const ts = new Date().toISOString();
	const utterance = req.body && req.body.userRequest && req.body.userRequest.utterance;
	console.log(`[${ts}] POST /api/kakao/christmas-movies from=${req.ip} host=${req.get('host')} utterance=${JSON.stringify(utterance)}`);
	console.log(`[${ts}] request body: ${JSON.stringify(req.body)}`);
	const body = buildResponse(req);
	console.log(`[${ts}] response body: ${JSON.stringify(body, null, 2)}`);
	res.json(body);
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, '0.0.0.0', () => console.log(`christmas-a2ui running on http://0.0.0.0:${PORT}`));
