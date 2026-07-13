const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
	fs.mkdirSync(publicDir, { recursive: true });
}

// SVG를 PNG로 변환하는 함수
async function generateImage(filename, bgColor, emoji, label) {
	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect fill="${bgColor}" width="200" height="200"/>
  <text x="100" y="70" font-size="60" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <text x="100" y="130" font-size="20" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;

	try {
		await sharp(Buffer.from(svg)).png().toFile(path.join(publicDir, filename));
		console.log(`✓ ${filename} 생성됨`);
	} catch (err) {
		console.error(`✗ ${filename} 생성 실패:`, err.message);
	}
}

// 냉장고 상태 이미지
async function generateRefrigeratorImages() {
	await generateImage('expired.png', '#E63946', '❌', '만료');
	await generateImage('approaching.png', '#FFD93D', '⚠️', '임박');
	await generateImage('fresh.png', '#6BCB77', '✓', '신선');
}

// 가전 기기 이미지
async function generateApplianceImages() {
	const appliances = [
		{ id: 'air_purifier', emoji: '💨', label: '공기청정기', color: '#4ECDC4' },
		{ id: 'robot_vacuum', emoji: '🤖', label: '로봇청소기', color: '#45B7D1' },
		{ id: 'air_conditioner', emoji: '❄️', label: '에어컨', color: '#96CEB4' },
		{ id: 'washer', emoji: '🌊', label: '세탁기', color: '#FFEAA7' },
		{ id: 'tv', emoji: '📺', label: 'TV', color: '#DDA0DD' },
	];

	for (const app of appliances) {
		await generateImage(`appliance_${app.id}.png`, app.color, app.emoji, app.label);
	}
}

// 모든 이미지 생성
async function main() {
	console.log('🖼️  이미지 생성 시작...');
	await generateRefrigeratorImages();
	await generateApplianceImages();
	console.log('✅ 모든 이미지 생성 완료!');
}

main().catch(err => {
	console.error('이미지 생성 중 오류:', err);
	process.exit(1);
});
