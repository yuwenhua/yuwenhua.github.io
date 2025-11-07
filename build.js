const fs = require('fs');
const path = require('path');
const marked = require('marked');

// 源目录（仓库根目录）
const srcDir = './';
// 输出目录（Cloudflare Pages 部署目录）
const distDir = './dist';

// 需要排除的文件/目录（无需处理的文件）
const excludeList = [
  '.git',          // 版本控制目录，跳过 
  'dist',          // 输出目录，避免递归复制
  'node_modules',  // npm 依赖目录，无需部署
  '.github',       // GitHub 配置目录，无需部署
  'package.json',  // 配置文件，无需部署
  'package-lock.json', // 依赖锁文件，无需部署
  'build.js'       // 构建脚本，无需部署
];

// 确保输出目录存在（若已存在，先清空，避免残留旧文件）
if (fs.existsSync(distDir)) {
  // 递归删除 dist 目录下所有文件
  function deleteDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        deleteDir(filePath);
        fs.rmdirSync(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });
  }
  deleteDir(distDir);
}
fs.mkdirSync(distDir, { recursive: true });

// 遍历目录处理文件（核心逻辑）
function processDir(currentDir) {
  const files = fs.readdirSync(currentDir);
  
  files.forEach(file => {
    // 跳过排除列表中的文件/目录
    if (excludeList.includes(file)) return;
    
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
      const htmlContent = marked.parse(mdContent); // Markdown 转 HTML
      const htmlFileName = path.basename(file, '.md') + '.html'; // 同名 HTML 文件
      const outFilePath = path.join(distDir, path.relative(srcDir, currentDir), htmlFileName);
      
      // 带 GitHub 风格样式的 HTML 模板
      const fullHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${path.basename(file, '.md')}</title>
  <!-- 引入 GitHub 官方 Markdown 样式，和 GitHub Pages 一致 -->
  <!-- <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.2.0/github-markdown.min.css"> -->
  <!-- 本地引用 GitHub Markdown 样式（无需依赖 CDN） -->
  <link rel="stylesheet" href="/css/github-markdown.min.css">
  <style>
  body { 
    max-width: 800px; 
    margin: 0 auto; 
    padding: 2rem; 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
    line-height: 1.6; 
    background: #121212; /* 深色背景 */
    color: #e0e0e0; /* 浅色文字 */
  }
  h1, h2, h3 { 
    border-bottom: 1px solid #333; 
    padding-bottom: 0.3rem; 
    color: #fff; /* 标题更亮 */
  }
  code { 
    background: #2d2d2d; 
    padding: 0.2rem 0.4rem; 
    border-radius: 4px; 
    color: #ccc; 
  }
  pre { 
    background: #2d2d2d; 
    padding: 1rem; 
    border-radius: 4px; 
    overflow-x: auto; 
    color: #ccc; 
  }
  blockquote { 
    border-left: 4px solid #444; 
    padding-left: 1rem; 
    color: #aaa; 
  }
</style>
</head>
<body>
  <div class="markdown-body">${htmlContent}</div>
</body>
</html>
      `;
      
      fs.writeFileSync(outFilePath, fullHtml, 'utf8');
      console.log(`✅ 转换完成：${filePath} → ${outFilePath}`);
    } else {
      // 非 .md 文件（图片、CSS、JS 等）直接复制到输出目录
      const outFilePath = path.join(distDir, path.relative(srcDir, currentDir), file);
      fs.copyFileSync(filePath, outFilePath);
      console.log(`📋 复制文件：${filePath} → ${outFilePath}`);
    }
  });
}

// 开始执行处理
processDir(srcDir);
console.log('\n🎉 所有文件处理完成！dist 目录已准备就绪～');
