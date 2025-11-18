const fs = require('fs');
const path = require('path');
const marked = require('marked');

// 从Markdown内容中提取标题，生成目录结构
function extractToc(mdContent) {
  const lines = mdContent.split('\n');
  const headings = [];
  
  // 使用简单可靠的ID生成方法
  function generateId(text, index) {
    // 方案1: 使用序号作为ID，简单可靠
    return `heading-${index}`;
    
    // 方案2: 如果仍需基于文本的ID，可以使用以下更安全的实现
    /*
    // 保留中文字符和基本符号
    let id = text.replace(/[^\w\s-\u4e00-\u9fa5]/g, '');
    // 将空格替换为连字符
    id = id.replace(/\s+/g, '-');
    // 添加索引作为后缀确保唯一性
    return `${id}-${index}`;
    */
  }
  
  // 提取所有标题行
  let headingIndex = 0;
  lines.forEach(line => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headingIndex++;
      const level = match[1].length; // 标题级别 1-6
      const text = match[2].trim(); // 标题文本
      
      // 使用基于索引的简单ID
      const id = generateId(text, headingIndex);
      
      headings.push({ level, text, id });
    }
  });
  
  return headings;
}

// 将标题数组转换为HTML目录
function generateTocHtml(headings) {
  if (headings.length === 0) return '';
  
  let tocHtml = '<div class="toc" style="background: #f5f5f5; padding: 1rem; border-radius: 4px; margin-bottom: 2rem;">' +
                '<h3 style="margin-top: 0;">目录</h3>' +
                '<ul style="list-style: none; padding-left: 0;">';
  
  let lastLevel = 1;
  
  headings.forEach(heading => {
    // 处理嵌套级别
    if (heading.level > lastLevel) {
      // 增加嵌套
      for (let i = lastLevel; i < heading.level; i++) {
        tocHtml += '<ul style="list-style: none; padding-left: 1.5rem;">';
      }
    } else if (heading.level < lastLevel) {
      // 减少嵌套
      for (let i = lastLevel; i > heading.level; i--) {
        tocHtml += '</ul>';
      }
    }
    
    tocHtml += `<li><a href="#${heading.id}" style="text-decoration: none; color: #0366d6;">${heading.text}</a></li>`;
    lastLevel = heading.level;
  });
  
  // 关闭所有未闭合的ul标签
  for (let i = lastLevel; i > 1; i--) {
    tocHtml += '</ul>';
  }
  
  tocHtml += '</ul></div>';
  return tocHtml;
}

// 修改marked渲染器，为标题添加ID属性
function createRenderer() {
  const renderer = new marked.Renderer();
  
  // 创建一个简单的标题计数器来生成一致的ID
let headingCounter = 0;

// 重写heading方法，添加ID属性
  renderer.heading = function(text, level) {
    // 与extractToc保持完全相同的ID生成逻辑
    headingCounter++;
    const id = `heading-${headingCounter}`; // 使用与extractToc相同的简单ID生成方案
    
    return `<h${level} id="${id}">${text}</h${level}>`;
  };
  
  return renderer;
}

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
      
      // 重置标题计数器，确保每个文件都从1开始计数
      headingCounter = 0;
      
      // 设置marked选项，使用自定义渲染器
      marked.setOptions({
        renderer: createRenderer(),
        breaks: true,
        gfm: true
      });
      
      // 转换Markdown为HTML
      const htmlContent = marked.parse(mdContent);
      
      // 只给usermanual.md和useragreement.md添加目录
      let contentWithToc = htmlContent;
      if (file === 'usermanual.md' || file === 'useragreement.md') {
        // 提取标题并生成目录
        const headings = extractToc(mdContent);
        const tocHtml = generateTocHtml(headings);
        contentWithToc = tocHtml + htmlContent;
      }
      
      const htmlFileName = path.basename(file, '.md') + '.html'; // 同名 HTML 文件
      const outFilePath = path.join(distDir, path.relative(srcDir, currentDir), htmlFileName);
      
      // 带 GitHub 风格样式的 HTML 模板
      const fullHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${path.basename(file, '.md')}</title>
  <!-- 引入 GitHub 官方 Markdown 样式，和 GitHub Pages 一致 -->
  <!-- <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.2.0/github-markdown.min.css"> -->
  <!-- 本地引用 GitHub Markdown 样式（无需依赖 CDN） -->
  <link rel="stylesheet" href="/css/github-markdown.min.css">
 <!-- white theme -->
<style>
  /* 页面整体：宽度100%，无额外边距 */
  body { 
    width: 100%; 
    margin: 0; 
    padding: 0; 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
    line-height: 1.6; 
    background: #fff; 
    color: #333; 
  }
  /* 文章容器：宽度100%，仅保留必要内边距 */
  .markdown-body { 
    width: 100%; 
    max-width: 800px; /* 大屏时限制最大宽度，避免内容过宽 */
    margin: 0 auto; 
    padding: 1rem; /* 移动端内边距缩小，增加内容显示区域 */
    box-sizing: border-box; /* 确保内边距不撑大容器 */
    background: #fff !important; 
    color: #333 !important; 
  }
  /* 标题：适配移动端字号 */
  h1, h2, h3 { 
    font-size: 1.8rem; /* 移动端标题适当缩小，避免换行过多 */
    border-bottom: 1px solid #eee; 
    padding-bottom: 0.3rem; 
    color: #222 !important; 
  }
  /* 段落文字：行高和字号优化 */
  p {
    font-size: 1rem;
    line-height: 1.8; /* 行高增加，提升可读性 */
  }
  /* 代码和引用：保持样式同时适配宽度 */
  code { 
    font-size: 0.9rem; 
    background: #f5f5f5 !important; 
    padding: 0.2rem 0.4rem; 
    border-radius: 4px; 
    color: #333 !important; 
  }
  pre { 
    font-size: 0.9rem; 
    background: #f5f5f5 !important; 
    padding: 1rem; 
    border-radius: 4px; 
    overflow-x: auto; 
    color: #333 !important; 
  }
  blockquote { 
    font-size: 0.95rem; 
    border-left: 4px solid #eee; 
    padding-left: 1rem; 
    color: #666 !important; 
  }
</style>
</head>
<body>
  <div class="markdown-body">${contentWithToc}</div>
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
