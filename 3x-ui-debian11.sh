#!/bin/bash

# 确保脚本以 root 用户运行
if [ "$(id -u)" -ne 0 ]; then
    echo "错误：此脚本需要以 root 用户身份运行。"
    exit 1
fi

echo "=================================="
echo "x-ui 安装脚本开始执行"
echo "=================================="

# 定义必需的命令列表
required_commands=("wget" "tar" "curl" "systemctl")
missing_commands=()

# 检查必需的命令是否存在
echo "正在检查必需的命令 (${required_commands[*]}) 是否存在..."
for cmd in "${required_commands[@]}"; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "警告: 命令 '$cmd' 未找到。"
        missing_commands+=("$cmd")
    fi
done

# 如果有缺少的命令，尝试安装
if [ ${#missing_commands[@]} -gt 0 ]; then
    echo "检测到缺少的命令：${missing_commands[*]}。正在尝试安装..."

    pkg_manager=""
    # 检测包管理器
    if command -v apt &>/dev/null; then
        pkg_manager="apt"
    elif command -v dnf &>/dev/null; then
        pkg_manager="dnf"
    elif command -v yum &>/dev/null; then
        pkg_manager="yum"
    fi

    if [ -z "$pkg_manager" ]; then
        echo "错误: 未找到支持的软件包管理器 (apt, dnf, yum)。无法自动安装依赖。请手动安装以下命令后重试: ${missing_commands[*]}。"
        exit 1
    fi

    echo "使用 '$pkg_manager' 包管理器进行安装。"

    # 执行安装
    if [ "$pkg_manager" == "apt" ]; then
        echo "正在更新软件包列表..."
        apt update || { echo "错误: apt update 失败。请检查您的软件包源。退出脚本。"; exit 1; }
        echo "正在安装缺少的命令: ${missing_commands[*]}..."
        apt install -y "${missing_commands[@]}" || { echo "错误: 使用 apt 安装依赖失败。退出脚本。"; exit 1; }
    elif [ "$pkg_manager" == "dnf" ] || [ "$pkg_manager" == "yum" ]; then
         echo "正在安装缺少的命令: ${missing_commands[*]}..."
        "$pkg_manager" install -y "${missing_commands[@]}" || { echo "错误: 使用 $pkg_manager 安装依赖失败。退出脚本。"; exit 1; }
    fi

    # 再次检查关键命令是否安装成功 (wget, tar, systemctl)
    echo "正在验证关键命令是否安装成功..."
    critical_commands=("wget" "tar" "systemctl")
    for cmd in "${critical_commands[@]}"; do
        if ! command -v "$cmd" &>/dev/null; then
             echo "错误: 关键命令 '$cmd' 安装失败或仍然不可用。请手动安装后重试。退出脚本。"
             exit 1
        fi
    done
    echo "所有必需的关键命令已可用。"

else
    echo "所有必需的命令都已找到。"
fi

echo "----------------------------------"

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
         if systemctl list-unit-files --no-legend 2>/dev/null | grep firewalld.service &>/dev/null; then
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
