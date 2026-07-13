const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
	fs.mkdirSync(publicDir, { recursive: true });
}

async function generateStatusImage(filename, bgColor, emoji, label) {
	const width = 800;
	const height = 400;

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      @font-face {
        font-family: 'NotoSansKR';
        src: url('data:font/woff2;base64,d09GMgABAAAAAAp8AA4AAAAAG+wAAop4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP7//wEAvwD9//EEmAwAmIQIAg6CAAEICgYAVIC7AAAA') format('woff2');
      }
    </style>
  </defs>
  <rect fill="${bgColor}" width="${width}" height="${height}"/>
  <text x="${width / 2}" y="${height / 2 - 40}" font-size="80" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <text x="${width / 2}" y="${height / 2 + 60}" font-size="48" font-family="Arial, sans-serif" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;

	try {
		await sharp(Buffer.from(svg))
			.png()
			.toFile(path.join(publicDir, filename));
		console.log(`✓ ${filename} 생성됨`);
	} catch (err) {
		console.error(`✗ ${filename} 생성 실패:`, err.message);
	}
}

async function main() {
	console.log('🖼️  냉장고 상태 이미지 생성 시작...');
	await generateStatusImage('expired.png', '#E63946', '❌', '만료');
	await generateStatusImage('approaching.png', '#FFD93D', '⚠️', '임박');
	await generateStatusImage('fresh.png', '#6BCB77', '✓', '신선');
	console.log('✅ 모든 이미지 생성 완료!');
}

main().catch(err => {
	console.error('이미지 생성 중 오류:', err);
	process.exit(1);
});
