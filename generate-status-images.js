const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
	fs.mkdirSync(publicDir, { recursive: true });
}

async function generateStatusImage(filename, bgColor) {
	const width = 800;
	const height = 400;

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect fill="${bgColor}" width="${width}" height="${height}"/>
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
	await generateStatusImage('expired.png', '#E63946');
	await generateStatusImage('approaching.png', '#FFD93D');
	await generateStatusImage('fresh.png', '#6BCB77');
	console.log('✅ 모든 이미지 생성 완료!');
}

main().catch(err => {
	console.error('이미지 생성 중 오류:', err);
	process.exit(1);
});
