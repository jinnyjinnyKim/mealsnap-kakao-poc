// 포스터 대체 이미지(글자 없음, 800x800) 생성 — 실제 포스터는 저작권 이슈로 사용하지 않는다.
// sharp 는 상위 kakao-poc/node_modules 에서 찾는다.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'public');
fs.mkdirSync(outDir, { recursive: true });

const POSTERS = [
	{ id: 'gospel', from: '#3b1d5a', to: '#12081f' },
	{ id: 'intern', from: '#7a1f2b', to: '#1d0b10' },
	{ id: 'cinema', from: '#4a3a1e', to: '#120d06' },
	{ id: 'scrooge', from: '#0f3d3a', to: '#06161a' },
];

function svg({ from, to }, seed) {
	let stars = '';
	for (let i = 0; i < 40; i++) {
		const x = ((seed * 97 + i * 211) % 780) + 10;
		const y = ((seed * 53 + i * 137) % 520) + 10;
		const r = 1 + ((i + seed) % 3);
		stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.3 + (i % 5) * 0.12}"/>`;
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="800" height="800" fill="url(#g)"/>${stars}
<polygon points="400,260 270,470 350,470 230,640 570,640 450,470 530,470" fill="#1f7a4d" opacity="0.95"/>
<rect x="378" y="640" width="44" height="60" fill="#5a3a1e"/>
<polygon points="400,200 412,238 452,238 420,262 432,300 400,276 368,300 380,262 348,238 388,238" fill="#ffd54a"/>
<circle cx="360" cy="520" r="12" fill="#e63946"/><circle cx="440" cy="560" r="12" fill="#ffd54a"/><circle cx="400" cy="420" r="12" fill="#4fc3f7"/>
</svg>`;
}

(async () => {
	for (const [i, p] of POSTERS.entries()) {
		await sharp(Buffer.from(svg(p, i + 1))).png().toFile(path.join(outDir, `poster_${p.id}.png`));
		console.log(`poster_${p.id}.png`);
	}
})();
