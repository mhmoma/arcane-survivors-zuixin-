# 项目发布：全局强制刷新缓存

当用户说“阅读项目中发布”或“执行项目中发布”时，按下面流程执行，不要只解释。

## 目标

强制刷新 `publish/` 中前端可缓存资源，让生产端重新拉取游戏最新版本，避免旧 CSS / JS / 图片缓存残留。

## 执行步骤

1. 运行全局刷新脚本：
   ```bash
   python3 /workspace/scripts/force-publish-refresh.py
   ```

2. 检查入口引用文件是否存在：
   ```bash
   python3 - <<'PY'
   from pathlib import Path
   import re
   html=Path('/workspace/publish/index.html').read_text()
   refs=re.findall(r'(?:src|href)="([^"#]+)', html)
   missing=[]
   for ref in refs:
       if ref.startswith(('http://','https://','data:')):
           continue
       path=ref.split('?')[0]
       p=(Path('/workspace/publish')/path).resolve() if path.startswith('./') else (Path('/workspace/publish')/path).resolve()
       if not p.exists():
           missing.append(ref)
   print('missing none' if not missing else '\n'.join(missing))
   PY
   ```

3. 检查 `publish/` 路径命名合规：
   ```bash
   find /workspace/publish \( -type f -o -type d \) 2>/dev/null \
     | LC_ALL=C grep -nP '[^\x00-\x7f]| ' || echo "✓ 全部合规"
   ```

4. 检查所有发布 JS 语法：
   ```bash
   for f in /workspace/publish/*.js; do node --check "$f" || exit 1; done
   ```

5. 检查都通过后保存：
   ```bash
   curl -X POST http://localhost:3005/git/save \
     -H "X-Container-Secret: 920548df-8319-40eb-934e-17af1ee9d5e1" \
     -H "Content-Type: application/json" \
     -d '{"message":"执行全局发布缓存刷新"}'
   ```

6. 最后提醒用户：
   - 先去 Preview 面板刷新确认效果。
   - 如果要同步线上生产端，还需要点击右上角「发布」。

## 注意

- 不要启动服务器。
- 不要删除旧资源文件，除非用户明确要求清理。
- `publish/` 下路径必须保持英文、数字、下划线、连字符、点，不能有中文或空格。
- 如果刷新脚本生成了新 CSS/JS 文件名，必须确认 `index.html` 引用无缺失。
