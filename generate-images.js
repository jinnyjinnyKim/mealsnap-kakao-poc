const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
	fs.mkdirSync(publicDir);
}

// 상태별 이미지 생성 (더 큰 사이즈, 더 시각적)
const generateImage = (filename, bgColor, text, textColor = '#fff') => {
	const canvas = createCanvas(200, 200);
	const ctx = canvas.getContext('2d');

	// 배경
	ctx.fillStyle = bgColor;
	ctx.fillRect(0, 0, 200, 200);

	// 동그란 배경 (상태 표시)
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

	// 파일로 저장
	const buffer = canvas.toBuffer('image/png');
	fs.writeFileSync(path.join(publicDir, filename), buffer);
	console.log(`✓ ${filename} 생성됨`);
};

// 상태별 이미지 생성
generateImage('expired.png', '#E63946', '만료', '#fff');
generateImage('approaching.png', '#F1FAEE', '임박', '#E63946');
generateImage('fresh.png', '#A8DADC', '신선', '#1D3557');

console.log('이미지 생성 완료!');
