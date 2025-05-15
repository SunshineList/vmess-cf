#!/bin/bash

# 确保脚本以 root 用户运行
if [ "$(id -u)" -ne 0 ]; then
    echo "错误：此脚本需要以 root 用户身份运行。"
    exit 1
fi

echo "=================================="
echo "x-ui 安装脚本开始执行"
echo "=================================="

# 尝试关闭防火墙（ufw/firewalld），以便服务可以正常运行
echo "正在尝试关闭防火墙（ufw/firewalld），以确保服务端口开放..."

# 检查并关闭 ufw
if command -v ufw &>/dev/null; then
    if ufw status | grep "Status: active" &>/dev/null; then
        echo "检测到 ufw 防火墙处于活动状态，正在尝试关闭..."
        ufw disable &>/dev/null
        systemctl stop ufw &>/dev/null
        if ! ufw status | grep "Status: active" &>/dev/null; then
            echo "ufw 防火墙已成功关闭。"
        else
            echo "警告: 尝试关闭 ufw 防火墙失败，可能需要手动处理。"
        fi
    else
        echo "未检测到 ufw 防火墙处于活动状态。"
    fi
else
    echo "系统中未安装 ufw 命令，跳过 ufw 处理。"
fi

# 检查并关闭 firewalld
if command -v systemctl &>/dev/null; then
    if systemctl is-active firewalld &>/dev/null; then
        echo "检测到 firewalld 防火墙处于活动状态，正在尝试关闭..."
        systemctl stop firewalld &>/dev/null
        systemctl disable firewalld &>/dev/null
         if ! systemctl is-active firewalld &>/dev/null; then
            echo "firewalld 防火墙已成功关闭并禁用自启动。"
         else
             echo "警告: 尝试关闭 firewalld 防火墙失败，可能需要手动处理。"
         fi
    else
         # Check if the service file exists even if not active
         if systemctl list-unit-files --no-legend | grep firewalld.service &>/dev/null; then
             echo "检测到 firewalld 服务但未处于活动状态。"
         else
             echo "系统中未安装 firewalld 服务，跳过 firewalld 处理。"
         fi
    fi
else
    echo "系统中未安装 systemctl (非 systemd 系统)，跳过 firewalld 处理。"
fi

echo "防火墙处理尝试完成。"
echo "----------------------------------"

# 切换到 /root/ 目录，以便下载和解压文件
echo "正在切换到 /root/ 目录..."
cd /root/ || { echo "错误: 无法切换到 /root/ 目录。请检查权限或目录是否存在。退出脚本。"; exit 1; }

# 清理旧的安装文件和目录
echo "正在清理旧的安装文件和目录..."
rm -rf x-ui/ /usr/local/x-ui/ /usr/bin/x-ui

# 下载 x-ui 安装包
echo "正在下载 x-ui 版本 2.4.1 安装包..."
wget https://github.com/Onair-santa/3X-UI-Debian11/releases/download/2.4.1/x-ui-linux-amd64.tar.gz -O x-ui-linux-amd64.tar.gz || { echo "错误: 下载失败。请检查网络连接。退出脚本。"; exit 1; }

# 解压安装包
echo "正在解压 x-ui 文件..."
tar zxvf x-ui-linux-amd64.tar.gz || { echo "错误: 解压失败。请检查下载文件是否完整。退出脚本。"; exit 1; }

# 清理下载的安装包
rm x-ui-linux-amd64.tar.gz

# 设置文件执行权限
echo "正在设置文件执行权限..."
chmod +x x-ui/x-ui x-ui/bin/xray-linux-* x-ui/x-ui.sh || { echo "错误: 设置权限失败。退出脚本。"; exit 1; }

# 复制文件到系统目录
echo "正在复制 x-ui 可执行文件和服务文件到系统目录..."
cp x-ui/x-ui.sh /usr/bin/x-ui || { echo "错误: 复制 x-ui.sh 到 /usr/bin/ 失败。退出脚本。"; exit 1; }
cp -f x-ui/x-ui.service /etc/systemd/system/ || { echo "错误: 复制 x-ui.service 到 /etc/systemd/system/ 失败。退出脚本。"; exit 1; }

# 移动安装目录到目标位置
echo "正在移动 x-ui 安装目录到 /usr/local/..."
mv x-ui/ /usr/local/ || { echo "错误: 移动 x-ui 目录到 /usr/local/ 失败。退出脚本。"; exit 1; }

# 重载 systemd 配置，启用并启动 x-ui 服务
echo "正在重载 systemd 配置，启用并启动 x-ui 服务..."
systemctl daemon-reload || { echo "错误: systemctl daemon-reload 失败。退出脚本。"; exit 1; }
systemctl enable x-ui || { echo "错误: systemctl enable x-ui 失败。退出脚本。"; exit 1; }
systemctl restart x-ui || { echo "错误: systemctl restart x-ui 失败。退出脚本。"; exit 1; }

echo "=================================="
echo "x-ui 安装完成。服务已重启。"
echo "您现在可以通过浏览器访问面板。请根据安装后的提示或日志查找默认端口和用户名密码。"
echo "=================================="
