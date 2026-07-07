const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
	fs.mkdirSync(publicDir);
}

// 상태별 이미지 생성
const generateImage = (filename, bgColor, text, textColor = '#fff') => {
	const canvas = createCanvas(100, 100);
	const ctx = canvas.getContext('2d');

	// 배경
	ctx.fillStyle = bgColor;
	ctx.fillRect(0, 0, 100, 100);

	// 텍스트
	ctx.fillStyle = textColor;
	ctx.font = 'bold 14px Arial';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, 50, 50);

	// 파일로 저장
	const buffer = canvas.toBuffer('image/png');
	fs.writeFileSync(path.join(publicDir, filename), buffer);
	console.log(`✓ ${filename} 생성됨`);
};

// 상태별 이미지 생성
generateImage('expired.png', '#FF4444', '만료', '#fff');
generateImage('approaching.png', '#FFAA00', '임박', '#fff');
generateImage('fresh.png', '#44AA44', '신선', '#fff');

console.log('이미지 생성 완료!');
