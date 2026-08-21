@echo off
chcp 65001 >nul
title AI 超级员工系统

echo ========================================
echo   AI 超级员工系统 - 一键启动
echo ========================================
echo.

REM ---- 检查 Node.js ----
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 20 LTS
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER%

REM ---- 检查 pnpm ----
where pnpm >nul 2>nul
if errorlevel 1 (
    echo [提示] 正在安装 pnpm...
    npm install -g pnpm@8
)
echo [OK] pnpm

REM ---- 检查 .env ----
if not exist ".env" (
    echo [提示] 从模板创建 .env
    copy .env.example .env >nul
)

REM ---- 检查 MySQL ----
where mysql >nul 2>nul
if errorlevel 1 (
    echo [警告] 未检测到 mysql 命令，请确保 MySQL 已安装并运行在 localhost:3306
    echo 如果使用 Docker：docker-compose up -d mysql
    echo.
    choice /c YN /m "MySQL 已就绪？(Y=继续 N=退出)"
    if errorlevel 2 exit /b 1
) else (
    echo [OK] MySQL 命令可用
)

REM ---- 安装依赖 ----
if not exist "node_modules" (
    echo.
    echo [步骤] 安装项目依赖（首次需要几分钟）...
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    pnpm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

REM ---- 数据库初始化 ----
cd packages\server
if not exist ".prisma\client\index.js" (
    echo.
    echo [步骤] 生成 Prisma Client...
    npx prisma generate
)
echo.
echo [步骤] 同步数据库表结构...
npx prisma db push --accept-data-loss
echo.
echo [步骤] 写入种子数据...
npx ts-node prisma\seed.ts
cd ..\..

REM ---- 启动服务 ----
echo.
echo ========================================
echo   系统启动中...
echo   前端: http://localhost:5173
echo   后端: http://localhost:3000
echo   API 文档: http://localhost:3000/docs
echo   账号: admin / admin123
echo ========================================
echo.
echo 按 Ctrl+C 停止服务
echo.

pnpm dev
