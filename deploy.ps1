# Підготовка та відправка коду на GitHub
# Запусти в терміналі Cursor (Ctrl+`) з папки проекту: .\deploy.ps1

git init
git remote add origin https://github.com/zhekanbutiak-ops/light-news-system.git 2>$null
git branch -M main
git add .
git commit -m "Final version for deploy"
git push -u origin main
