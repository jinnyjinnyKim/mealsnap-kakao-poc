const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
	fs.mkdirSync(publicDir, { recursive: true });
}

const APPLIANCES = [
	{
		id: 'air_purifier',
		url: 'https://www.lge.co.kr/kr/upload/admin/storyThumbnail/air-purifier-care-solutions-thumb-640x800_20250522_124759.jpg'
	},
	{
		id: 'robot_vacuum',
		url: 'https://static.lge.co.kr/kr/images/vacuum-cleaners/md10436830/usp/B95AWBTH_grid_Interior_modern_pc_03.png'
	},
	{
		id: 'air_conditioner',
		url: 'https://www.lge.co.kr/kr/upload/admin/storyThumbnail/lg-air-conditioners-guide-thumb-640x800_20260213_144956.jpg'
	},
	{
		id: 'dehumidifier',
		url: 'https://www.lge.co.kr/kr/upload/admin/storyThumbnail/main_P02_20260105_111404.jpg'
	},
	{
		id: 'tv',
		url: 'https://www.lge.co.kr/kr/upload/admin/storyThumbnail/air-purifier-care-solutions-thumb-640x800_20250522_124759.jpg'
	}
];

async function downloadImage(url) {
	return new Promise((resolve, reject) => {
		const protocol = url.startsWith('https') ? https : http;
		const options = {
			timeout: 10000,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
			}
		};

		const request = protocol.get(url, options, (res) => {
			// 리다이렉트 처리
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				return downloadImage(res.headers.location).then(resolve).catch(reject);
			}

			if (res.statusCode !== 200) {
				return reject(new Error(`Status ${res.statusCode}`));
			}

			const chunks = [];
			res.on('data', chunk => chunks.push(chunk));
			res.on('end', () => {
				const buffer = Buffer.concat(chunks);
				if (buffer.length === 0) {
					return reject(new Error('Empty response'));
				}
				resolve(buffer);
			});
			res.on('error', reject);
		});

		request.on('error', reject);
		request.on('timeout', () => {
			request.destroy();
			reject(new Error('Download timeout'));
		});
	});
}

async function processImage(appliance) {
	try {
		console.log(`📥 Downloading ${appliance.id}...`);
		const imageBuffer = await downloadImage(appliance.url);

		console.log(`🔄 Resizing ${appliance.id} to 200x200...`);
		const filename = `appliance_${appliance.id}.jpg`;
		await sharp(imageBuffer)
			.resize(200, 200, {
				fit: 'cover',
				position: 'center'
			})
			.jpeg({ quality: 85 })
			.toFile(path.join(publicDir, filename));

		console.log(`✓ ${filename} 완료`);
	} catch (err) {
		console.error(`✗ ${appliance.id} 처리 실패:`, err.message);
	}
}

async function main() {
	console.log('🖼️  이미지 다운로드 및 리사이즈 시작...');
	for (const appliance of APPLIANCES) {
		await processImage(appliance);
	}
	console.log('✅ 모든 이미지 처리 완료!');
}

main().catch(err => {
	console.error('이미지 처리 중 오류:', err);
	process.exit(1);
});
