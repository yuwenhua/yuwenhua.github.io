const fs = require('fs');
const path = require('path');
const marked = require('marked');

// 源目录（你的 Markdown 文件所在目录，默认仓库根目录）
const srcDir = './';
// 输出目录（Cloudflare Pages 最终读取的目录，建议叫 dist）
const distDir = './dist';

// 确保输出目录存在
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 遍历目录下所有文件
function processDir(currentDir) {
  const files = fs.readdirSync(currentDir);
  
  files.forEach(file => {
    const filePath = path.join(currentDir, file);
    const stats = fs.statSync(filePath);
    
    // 如果是目录，递归处理
    if (stats.isDirectory()) {
      const outDir = path.join(distDir, path.relative(srcDir, currentDir), file);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      processDir(filePath);
      return;
    }
    
    // 如果是 .md 文件，转换为 HTML
    if (path.extname(file) === '.md') {
      const mdContent = fs.readFileSync(filePath, 'utf8');
      // Markdown 转 HTML（支持 GitHub 风格的语法）
      const htmlContent = marked.parse(mdContent);
      // 生成 HTML 文件名（和 .md 文件同名）
      const htmlFileName = path.basename(file, '.md') + '.html';
      const outFilePath = path.join(distDir, path.relative(srcDir, currentDir), htmlFileName);
      
      // 写入 HTML 文件（添加基础样式，避免太丑）
      const fullHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${path.basename(file, '.md')}</title>
  <style>
    body { max-width: 800px; margin: 0 auto; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; }
    h1, h2, h3 { border-bottom: 1px solid #eee; padding-bottom: 0.3rem; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 4px; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    blockquote { border-left: 4px solid #eee; padding-left: 1rem; color: #666; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
      `;
      
      fs.writeFileSync(outFilePath, fullHtml, 'utf8');
      console.log(`转换完成：${filePath} → ${outFilePath}`);
    } else {
      // 非 .md 文件（如 CSS、JS、图片）直接复制到输出目录
      const outFilePath = path.join(distDir, path.relative(srcDir, currentDir), file);
      fs.copyFileSync(filePath, outFilePath);
      console.log(`复制文件：${filePath} → ${outFilePath}`);
    }
  });
}

// 开始执行转换
processDir(srcDir);
console.log('✅ 所有文件处理完成！');
