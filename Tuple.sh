#!/usr/bin/env bash
# Alpine 自举：若被 sh 直接执行（无 bash），先装 bash 再用 bash 重启
if [ -z "${BASH_VERSION:-}" ]; then
    if command -v apk >/dev/null 2>&1; then
        echo "检测到 Alpine 且无 bash，正在安装 bash..."
        apk add --no-cache bash >/dev/null 2>&1
        exec bash "$0" "$@"
    else
        echo "请用 bash 运行: bash $0"
        exit 1
    fi
fi
# ============================================================
# Tuple · sing-box 四协议一键脚本
# 协议: VLESS-Reality | VMess-WS-Argo | Hysteria2 | TUIC v5
# 精简点: 无 WARP / 无远程规则集 / 无额外协议菜单 / 日志关闭
# 保留: Jetpac eSIM 免流节点一键设置
# 用法: bash Tuple.sh [-i|-c|-e|-u|-h]
# ============================================================

export LANG=en_US.UTF-8

R='\033[0m'; RED='\033[1;91m'; GRN='\e[1;32m'; YEL='\e[1;33m'; PUR='\e[1;35m'; SKY='\e[1;36m'
red()    { echo -e "${RED}$1${R}"; }
green()  { echo -e "${GRN}$1${R}"; }
yellow() { echo -e "${YEL}$1${R}"; }
purple() { echo -e "${PUR}$1${R}"; }
skyblue(){ echo -e "${SKY}$1${R}"; }
reading(){ read -p "$(red "$1")" "$2"; }

check_root() { [[ $EUID -ne 0 ]] && red "请用 root 运行: sudo -i" && exit 1; }
command_exists() { command -v "$1" >/dev/null 2>&1; }

# ---------- 常量 ----------
work_dir="/etc/tuple"
conf_dir="${work_dir}/conf"
client_dir="${work_dir}/url.txt"
sub_file="${work_dir}/sub.txt"
server_name="sing-box"
vless_port=${PORT:-$(shuf -i 10000-65000 -n 1)}
argo_port=${ARGO_PORT:-8001}
cf_ip=${CFIP:-'cdns.doon.eu.org'}
cf_port=${CFPORT:-443}
dns_strategy=${DNS_STRATEGY:-prefer_ipv4}
reality_sni=${SNI:-'www.iij.ad.jp'}
tls_sni="www.bing.com"
esim_domain=""

check_singbox() { check_service "tuple" "${work_dir}/${server_name}"; }
check_argo()    { check_service "tuple-argo" "${work_dir}/argo"; }
check_web() {
    local svc=$web_server
    command_exists "$svc" || { red "not installed"; return 2; }
    check_service "$svc" "$(command -v "$svc")"
}
check_nginx() { check_web; }

check_service() {
    local s=$1 f=$2
    [[ ! -f "$f" ]] && { red "not installed"; return 2; }
    if command_exists rc-service; then
        rc-service "$s" status 2>/dev/null | grep -q "started" && green "running" || yellow "not running"
    else
        systemctl is-active "$s" 2>/dev/null | grep -q "^active$" && green "running" || yellow "not running"
    fi
}

# Web 服务: nginx(默认) / caddy
web_server=${WEB:-nginx}
web_mode_file="${work_dir}/.webmode"
# 独立运行 -c/-e/-u 时回读已安装时选择的 Web 服务
[ -f "$web_mode_file" ] && web_server=$(cat "$web_mode_file" 2>/dev/null || echo "$web_server")

# ---------- 依赖 ----------
install_deps() {
    yellow "安装依赖 (Web: ${web_server})...\n"
    local pkgs="jq openssl curl coreutils ca-certificates iproute2"
    if [ "$web_server" = "caddy" ]; then
        pkgs="$pkgs caddy"
        # caddy 官方源（apt）
        if command_exists apt && ! command_exists caddy; then
            DEBIAN_FRONTEND=noninteractive apt install -y debian-keyring debian-archive-keyring apt-transport-https >/dev/null 2>&1
            rm -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
            curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' 2>/dev/null | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
            curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' 2>/dev/null > /etc/apt/sources.list.d/caddy-stable.list
            DEBIAN_FRONTEND=noninteractive apt update -y >/dev/null 2>&1
        fi
    else
        pkgs="$pkgs nginx"
    fi
    if command_exists apk; then
        apk update >/dev/null 2>&1
        apk add bash $pkgs >/dev/null 2>&1
    elif command_exists apt; then
        DEBIAN_FRONTEND=noninteractive apt update -y >/dev/null 2>&1
        DEBIAN_FRONTEND=noninteractive apt install -y $pkgs >/dev/null 2>&1
    elif command_exists dnf || command_exists yum; then
        (command_exists dnf && dnf install -y $pkgs || yum install -y $pkgs) >/dev/null 2>&1
    else
        red "未知系统，请手动安装 $pkgs"; return 1
    fi
    green "依赖就绪\n"
}

# IP 策略: v4(默认,有IPv4就用) / v6(有IPv6就用) / auto(原逻辑:优先IPv6)
ip_mode=${IP_MODE:-v4}
ip_mode_file="${work_dir}/.ipmode"

get_realip() {
    local ip4 ip6 org mode="$ip_mode"
    [ -f "$ip_mode_file" ] && mode=$(cat "$ip_mode_file" 2>/dev/null || echo "$ip_mode")
    ip4=$(curl -4 -sm 2 ip.sb)
    ip6(){ curl -6 -sm 2 ip.sb; }
    # curl 失败时从本地网卡兜底（Alpine/小机器无 curl 外网时也能生成链接）
    [ -z "$ip4" ] && ip4=$(ip -4 -o addr 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | grep -v '^127\.' | head -1)
    [ -z "$ip4" ] && ip4=$(hostname -i 2>/dev/null | awk '{print $1}')
    case "$mode" in
        v4)
            # 只要 IPv4 不是 WARP 就返回它；没有 IPv4 才退回 IPv6
            org=$(curl -4 -sm 2 http://ipinfo.io/org)
            if [ -n "$ip4" ] && ! echo "$org" | grep -qE 'Cloudflare|UnReal|AEZA|Andrei'; then
                echo "$ip4"
            else
                local v6; v6=$(ip6); [ -n "$v6" ] && echo "[$v6]" || echo "$ip4"
            fi
            ;;
        v6)
            local v6; v6=$(ip6)
            [ -n "$v6" ] && echo "[$v6]" || echo "$ip4"
            ;;
        *)
            # auto: 原逻辑，有 IPv6 且非 WARP 则优先 IPv6
            [ -z "$ip4" ] && { echo "[$(ip6)]"; return; }
            org=$(curl -4 -sm 2 http://ipinfo.io/org)
            if echo "$org" | grep -qE 'Cloudflare|UnReal|AEZA|Andrei'; then
                echo "[$(ip6)]"
            elif grep -qE '^\s*precedence\s+::ffff:0:0/96\s+100' /etc/gai.conf 2>/dev/null; then
                echo "$ip4"
            else
                local v6; v6=$(ip6); [ -n "$v6" ] && echo "[$v6]" || echo "$ip4"
            fi
            ;;
    esac
}

allow_port() {
    local u=0 f=0 i4=0 i6=0
    command_exists ufw && u=1
    command_exists firewall-cmd && systemctl is-active firewalld >/dev/null 2>&1 && f=1
    command_exists iptables && i4=1
    command_exists ip6tables && i6=1
    [ $u -eq 1 ] && ufw --force default allow outgoing >/dev/null 2>&1
    [ $f -eq 1 ] && firewall-cmd --permanent --zone=public --set-target=ACCEPT >/dev/null 2>&1
    [ $i4 -eq 1 ] && { iptables -C INPUT -i lo -j ACCEPT 2>/dev/null || iptables -I INPUT 3 -i lo -j ACCEPT; }
    [ $i6 -eq 1 ] && { ip6tables -C INPUT -i lo -j ACCEPT 2>/dev/null || ip6tables -I INPUT 3 -i lo -j ACCEPT; }
    for rule in "$@"; do
        local p=${rule%/*} pr=${rule#*/}
        [ $u -eq 1 ] && ufw allow in ${p}/${pr} >/dev/null 2>&1
        [ $f -eq 1 ] && firewall-cmd --permanent --add-port=${p}/${pr} >/dev/null 2>&1
        [ $i4 -eq 1 ] && (iptables -C INPUT -p ${pr} --dport ${p} -j ACCEPT 2>/dev/null || iptables -I INPUT 4 -p ${pr} --dport ${p} -j ACCEPT)
        [ $i6 -eq 1 ] && (ip6tables -C INPUT -p ${pr} --dport ${p} -j ACCEPT 2>/dev/null || ip6tables -I INPUT 4 -p ${pr} --dport ${p} -j ACCEPT)
    done
    [ $f -eq 1 ] && firewall-cmd --reload >/dev/null 2>&1
    if command_exists rc-service; then
        [ $i4 -eq 1 ] && iptables-save > /etc/iptables/rules.v4 2>/dev/null
        [ $i6 -eq 1 ] && ip6tables-save > /etc/iptables/rules.v6 2>/dev/null
    elif command_exists netfilter-persistent; then
        netfilter-persistent save >/dev/null 2>&1
    fi
}

gen_cert() {
    local cn=${1:-$tls_sni}
    openssl ecparam -genkey -name prime256v1 -out "${work_dir}/private.key" 2>/dev/null
    openssl req -new -x509 -days 3650 -key "${work_dir}/private.key" \
        -out "${work_dir}/cert.pem" -subj "/CN=${cn}" 2>/dev/null
    fingerprint=$(openssl x509 -noout -fingerprint -sha256 -in "${work_dir}/cert.pem" \
        | cut -d'=' -f2 | sed 's/:/%3A/g')
}

service_ctl() {
    local s=$1 a=$2
    if command_exists rc-service; then rc-service "$s" "$a" >/dev/null 2>&1
    elif command_exists systemctl; then systemctl "$a" "$s" >/dev/null 2>&1; fi
}
start_tuple(){ service_ctl tuple start; }
stop_tuple(){ service_ctl tuple stop; }
restart_tuple(){ service_ctl tuple restart; }
start_argo(){ service_ctl tuple-argo start; }
restart_argo(){ service_ctl tuple-argo restart; }
start_web(){ service_ctl "$web_server" start; }
restart_web(){ service_ctl "$web_server" restart; }
start_nginx(){ start_web; }
restart_nginx(){ restart_web; }

# ---------- 安装核心 ----------
install_tuple() {
    clear; purple "正在安装 Tuple 四协议节点，请稍后...\n"
    case "$(uname -m)" in
        x86_64|amd64) ARCH=amd64 ;;
        x86|i686|i386) ARCH=386 ;;
        aarch64|arm64) ARCH=arm64 ;;
        armv7l) ARCH=armv7 ;;
        s390x) ARCH=s390x ;;
        *) red "不支持的架构: $(uname -m)"; exit 1 ;;
    esac

    mkdir -p "$work_dir" "$conf_dir"
    local base="https://${ARCH}.eooce.com"
    curl -sLo "${work_dir}/qrencode" "$base/qrencode"
    curl -sLo "${work_dir}/sing-box" "$base/sb"
    curl -sLo "${work_dir}/argo" "$base/bot"
    chmod +x "${work_dir}/sing-box" "${work_dir}/argo" "${work_dir}/qrencode"

    nginx_port=$((vless_port + 1))
    tuic_port=$((vless_port + 2))
    hy2_port=$((vless_port + 3))
    uuid=$(cat /proc/sys/kernel/random/uuid)
    sub_path=$(< /dev/urandom tr -dc 'A-Za-z0-9' | head -c 24)

    local kp; kp=$("${work_dir}/sing-box" generate reality-keypair)
    private_key=$(echo "$kp" | awk '/PrivateKey:/ {print $2}')
    public_key=$(echo "$kp" | awk '/PublicKey:/ {print $2}')

    allow_port ${vless_port}/tcp ${nginx_port}/tcp ${tuic_port}/udp ${hy2_port}/udp >/dev/null 2>&1
    gen_cert "$tls_sni"

    # 小机器优化: 关闭日志写入 / 不启用 NTP / 不下载远程规则集
    cat > "${conf_dir}/log.json" << EOF
{
  "log": { "disabled": true, "level": "error", "timestamp": false }
}
EOF
    cat > "${conf_dir}/dns.json" << EOF
{
  "dns": {
    "servers": [{ "tag": "local", "type": "local" }],
    "strategy": "$dns_strategy"
  }
}
EOF
    cat > "${conf_dir}/inbounds.json" << EOF
{
  "inbounds": [
    {
      "type": "vless", "tag": "vless-reality", "listen": "::", "listen_port": $vless_port,
      "users": [{ "uuid": "$uuid", "flow": "xtls-rprx-vision" }],
      "tls": {
        "enabled": true, "server_name": "$reality_sni",
        "reality": {
          "enabled": true,
          "handshake": { "server": "$reality_sni", "server_port": 443 },
          "private_key": "$private_key", "short_id": [""]
        }
      }
    },
    {
      "type": "vmess", "tag": "vmess-ws", "listen": "::", "listen_port": $argo_port,
      "users": [{ "uuid": "$uuid" }],
      "transport": {
        "type": "ws", "path": "/vmess-argo",
        "early_data_header_name": "Sec-WebSocket-Protocol"
      }
    },
    {
      "type": "hysteria2", "tag": "hysteria2", "listen": "::", "listen_port": $hy2_port,
      "users": [{ "password": "$uuid" }],
      "ignore_client_bandwidth": false,
      "masquerade": "https://$tls_sni",
      "tls": {
        "enabled": true, "alpn": ["h3"], "min_version": "1.3", "max_version": "1.3",
        "certificate_path": "${work_dir}/cert.pem", "key_path": "${work_dir}/private.key"
      }
    },
    {
      "type": "tuic", "tag": "tuic", "listen": "::", "listen_port": $tuic_port,
      "users": [{ "uuid": "$uuid", "password": "$uuid" }],
      "congestion_control": "bbr",
      "tls": {
        "enabled": true, "alpn": ["h3"],
        "certificate_path": "${work_dir}/cert.pem", "key_path": "${work_dir}/private.key"
      }
    }
  ]
}
EOF
    cat > "${conf_dir}/outbounds.json" << 'EOF'
{ "outbounds": [{ "type": "direct", "tag": "direct" }] }
EOF
    cat > "${conf_dir}/route.json" << 'EOF'
{ "route": { "rules": [], "final": "direct" } }
EOF
    green "核心配置写入完成\n"
}

# ---------- 服务 ----------
install_services() {
    if command_exists systemctl; then
        cat > /etc/systemd/system/tuple.service << EOF
[Unit]
Description=Tuple sing-box service
After=network.target nss-lookup.target
[Service]
User=root
WorkingDirectory=/etc/tuple
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW
ExecStart=/etc/tuple/sing-box run -C /etc/tuple/conf
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=10
LimitNOFILE=1024
[Install]
WantedBy=multi-user.target
EOF
        cat > /etc/systemd/system/tuple-argo.service << EOF
[Unit]
Description=Tuple Cloudflare Tunnel
After=network.target
[Service]
Type=simple
NoNewPrivileges=yes
TimeoutStartSec=0
ExecStart=/bin/sh -c "/etc/tuple/argo tunnel --url http://localhost:${argo_port} --no-autoupdate --edge-ip-version auto --protocol http2 > /etc/tuple/argo.log 2>&1"
Restart=on-failure
RestartSec=5s
[Install]
WantedBy=multi-user.target
EOF
        if [ -f /etc/centos-release ]; then
            yum install -y chrony >/dev/null 2>&1
            systemctl enable --now chronyd >/dev/null 2>&1
            chronyc -a makestep >/dev/null 2>&1
            echo "0 0" > /proc/sys/net/ipv4/ping_group_range
        fi
        systemctl daemon-reload
        systemctl enable --now tuple tuple-argo >/dev/null 2>&1
    elif command_exists rc-service; then
        echo "0 0" > /proc/sys/net/ipv4/ping_group_range
        sed -i '1s/.*/127.0.0.1   localhost/' /etc/hosts
        sed -i '2s/.*/::1         localhost/' /etc/hosts
        cat > /etc/init.d/tuple << 'EOF'
#!/sbin/openrc-run
description="Tuple sing-box service"
command="/etc/tuple/sing-box"
command_args="run -C /etc/tuple/conf"
command_background=true
pidfile="/var/run/tuple.pid"
EOF
        cat > /etc/init.d/tuple-argo << EOF
#!/sbin/openrc-run
description="Tuple Cloudflare Tunnel"
command="/bin/sh"
command_args="-c '/etc/tuple/argo tunnel --url http://localhost:${argo_port} --no-autoupdate --edge-ip-version auto --protocol http2 > /etc/tuple/argo.log 2>&1'"
command_background=true
pidfile="/var/run/tuple-argo.pid"
EOF
        chmod +x /etc/init.d/tuple /etc/init.d/tuple-argo
        rc-update add tuple default >/dev/null 2>&1
        rc-update add tuple-argo default >/dev/null 2>&1
        rc-service tuple restart >/dev/null 2>&1
        rc-service tuple-argo restart >/dev/null 2>&1
    else
        red "不支持的 init 系统"; exit 1
    fi
    green "服务已启动\n"
}

# ---------- 订阅 Web 服务 (nginx / caddy) ----------
add_nginx_conf() {
    if [ "$web_server" = "caddy" ]; then
        add_caddy_conf
        return
    fi
    # Alpine 的 nginx.conf 在 root context include conf.d（模块用），server 块要放 http.d
    local nginx_d="/etc/nginx/conf.d"
    command_exists apk && nginx_d="/etc/nginx/http.d"
    mkdir -p "$nginx_d"
    # 清理旧版本/异系统残留，避免 include 冲突
    rm -f /etc/nginx/conf.d/tuple.conf /etc/nginx/conf.d/tuple.conf.bak
    [ -f "${nginx_d}/tuple.conf" ] && cp "${nginx_d}/tuple.conf" "${nginx_d}/tuple.conf.bak"
    cat > "${nginx_d}/tuple.conf" << EOF
server {
    listen ${nginx_port};
    listen [::]:${nginx_port};
    server_name _;
    location = /${sub_path} {
        alias ${sub_file};
        default_type 'text/plain; charset=utf-8';
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    location / { return 404; }
    location ~ /\\. { deny all; access_log off; log_not_found off; }
}
EOF
    if [ ! -f /etc/nginx/nginx.conf ]; then
        mkdir -p /var/log/nginx /run
        cat > /etc/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes 1;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;
events { worker_connections 512; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 30;
    include /etc/nginx/conf.d/*.conf;
}
EOF
    fi
    if nginx -t >/dev/null 2>&1; then
        restart_web
        if command_exists systemctl; then systemctl enable nginx >/dev/null 2>&1
        elif command_exists rc-update; then rc-update add nginx default >/dev/null 2>&1; fi
        green "订阅服务已就绪 (nginx)\n"
    else
        yellow "nginx 配置检测失败，请手动检查 ${nginx_d}/tuple.conf\n"
    fi
}

add_caddy_conf() {
    local web_root="${work_dir}/web"
    mkdir -p "$web_root"
    cp "$sub_file" "${web_root}/${sub_path}"
    chmod 644 "${web_root}/${sub_path}"
    mkdir -p /etc/caddy
    [ -f /etc/caddy/Caddyfile ] && cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
    cat > /etc/caddy/Caddyfile << EOF
{
    auto_https off
    admin off
}
:${nginx_port} {
    @sub path /${sub_path}
    handle @sub {
        header Content-Type "text/plain; charset=utf-8"
        header Cache-Control "no-cache, no-store, must-revalidate"
        root * ${web_root}
        file_server
    }
    handle {
        respond 404
    }
}
EOF
    if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
        restart_web
        if command_exists systemctl; then systemctl enable caddy >/dev/null 2>&1
        elif command_exists rc-update; then rc-update add caddy default >/dev/null 2>&1; fi
        green "订阅服务已就绪 (caddy)\n"
    else
        yellow "Caddy 配置检测失败，请手动检查 /etc/caddy/Caddyfile\n"
    fi
}

# ---------- 生成节点 ----------
get_argo_domain() {
    local f="${work_dir}/argo.log"
    argo_domain=""
    for i in 1 2 3 4 5; do
        [ -f "$f" ] && argo_domain=$(sed -n 's|.*https://\([^/]*trycloudflare\.com\).*|\1|p' "$f" | head -1)
        [ -n "$argo_domain" ] && break
        [ $i -eq 1 ] && restart_argo
        sleep 2
    done
    green "ArgoDomain: ${PUR}${argo_domain}${R}\n"
}

get_info() {
    yellow "\nIP 检测中...\n"
    local server_ip; server_ip=$(get_realip)
    local isp
    isp=$(curl -sm 3 -H "User-Agent: Mozilla/5.0" "https://api.ip.sb/geoip" | tr -d '\n' \
        | awk -F\" '{c="";i="";for(x=1;x<=NF;x++){if($x=="country_code")c=$(x+2);if($x=="isp")i=$(x+2)};if(c&&i)print c"-"i}' \
        | sed 's/ /_/g' || echo "Tuple")
    get_argo_domain

    local vmess_json="{\"v\":\"2\",\"ps\":\"${isp}\",\"add\":\"${cf_ip}\",\"port\":\"${cf_port}\",\"id\":\"${uuid}\",\"aid\":\"0\",\"scy\":\"auto\",\"net\":\"ws\",\"type\":\"none\",\"host\":\"${argo_domain}\",\"path\":\"/vmess-argo?ed=2560\",\"tls\":\"tls\",\"sni\":\"${argo_domain}\",\"alpn\":\"\",\"fp\":\"firefox\",\"allowInsecure\":\"false\"}"

    cat > "$client_dir" << EOF
vless://${uuid}@${server_ip}:${vless_port}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${reality_sni}&fp=firefox&pbk=${public_key}&type=tcp&headerType=none#${isp}

vmess://$(echo "$vmess_json" | base64 -w0)

hysteria2://${uuid}@${server_ip}:${hy2_port}/?sni=${tls_sni}&insecure=1&pinSHA256=${fingerprint}&alpn=h3&obfs=none#${isp}

tuic://${uuid}:${uuid}@${server_ip}:${tuic_port}?sni=${tls_sni}&congestion_control=bbr&udp_relay_mode=native&alpn=h3&allow_insecure=1#${isp}
EOF
    [ -n "$esim_domain" ] && set_esim_links "$esim_domain"

    base64 -w0 "$client_dir" > "$sub_file"
    chmod 644 "$sub_file"
    print_nodes
}

print_nodes() {
    # 独立运行 -c/-e 时回读订阅端口和路径（兼容 nginx / caddy）
    local np sp
    if [ "$web_server" = "caddy" ]; then
        [ -f /etc/caddy/Caddyfile ] && {
            np=$(sed -n 's/^:\([0-9][0-9]*\).*/\1/p' /etc/caddy/Caddyfile | head -1)
            sp=$(sed -n 's|.*@sub path /\([^ ]*\).*|\1|p' /etc/caddy/Caddyfile)
        }
    else
        local nd="/etc/nginx/conf.d"
        command_exists apk && nd="/etc/nginx/http.d"
        if [ -f "${nd}/tuple.conf" ]; then
            np=$(sed -n 's/^\s*listen \([0-9]\+\);/\1/p' "${nd}/tuple.conf" | head -1)
            sp=$(sed -n 's|.*location = /\([^ ]*\).*|\1|p' "${nd}/tuple.conf")
        fi
    fi
    nginx_port=${nginx_port:-$np}
    sub_path=${sub_path:-$sp}
    clear; echo ""
    green "=== Tuple 四协议节点 ===\n"
    while IFS= read -r line; do [ -n "$line" ] && echo -e "${PUR}${line}${R}\n"; done < "$client_dir"
    local server_ip; server_ip=$(get_realip)
    # IPv6 裸地址必须加方括号才能放进 URL
    case "$server_ip" in
        *:*) case "$server_ip" in \[*\]) ;; *) server_ip="[${server_ip}]" ;; esac ;;
    esac
    local base_url="http://${server_ip}:${nginx_port}/${sub_path}"
    green "\n=== 订阅链接 ===\n"
    echo -e "V2rayN/Shadowrocket/Nekobox: ${PUR}${base_url}${R}"
    echo -e "Clash/Mihomo: ${PUR}https://sublink.eooce.com/clash?config=${base_url}${R}"
    echo -e "Sing-box:     ${PUR}https://sublink.eooce.com/singbox?config=${base_url}${R}"
    echo -e "Surge:        ${PUR}https://sublink.eooce.com/surge?config=${base_url}${R}"
    [ -x "${work_dir}/qrencode" ] && "${work_dir}/qrencode" "$base_url"
    yellow "\n提示: hysteria2/tuic 不通时把客户端「跳过证书验证」设为 true\n"
}

# ---------- Jetpac eSIM 免流 ----------
set_esim_links() {
    local domain=$1
    local tmp="${client_dir}.tmp"; : > "$tmp"
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            vless://*)
                line=$(echo "$line" | sed -E 's|([?&]sni=)[^&#]*|\1'"${domain}"'|') ;;
            hysteria2://*)
                line=$(echo "$line" | sed -E \
                    -e 's|([?&]sni=)[^&#]*|\1'"${domain}"'|' \
                    -e 's|([?&]pinSHA256=)[^&#]*|\1'"${fingerprint}"'|') ;;
            tuic://*)
                line=$(echo "$line" | sed -E 's|([?&]sni=)[^&#]*|\1'"${domain}"'|') ;;
        esac
        echo "$line" >> "$tmp"
    done < "$client_dir"
    mv "$tmp" "$client_dir"
    base64 -w0 "$client_dir" > "$sub_file"
}

set_jetpac_esim() {
    check_singbox &>/dev/null
    [ $? -eq 2 ] && { yellow "Tuple 尚未安装"; sleep 1; menu; return; }
    clear; echo ""
    green "=== 一键设置 Jetpac eSIM 免流节点 ===\n"
    echo "  1. maps.google.com  (默认)"
    echo "  2. api.whatsapp.com"
    echo "  3. grab.com"
    echo "  4. wa.me"
    reading "请选择免流域名 (回车默认 1): " esim_choice
    case "$esim_choice" in
        2) domain="api.whatsapp.com" ;;
        3) domain="grab.com" ;;
        4) domain="wa.me" ;;
        *) domain="maps.google.com" ;;
    esac
    green "\n免流域名: ${PUR}${domain}${R}\n"

    local inbounds="${conf_dir}/inbounds.json"
    jq --arg d "$domain" '
        (.inbounds[] | select(.tag == "vless-reality") | .tls.server_name) = $d |
        (.inbounds[] | select(.tag == "vless-reality") | .tls.reality.handshake.server) = $d |
        (.inbounds[] | select(.tag == "hysteria2") | .masquerade) = ("https://" + $d)
    ' "$inbounds" > "${inbounds}.tmp" && mv "${inbounds}.tmp" "$inbounds"

    yellow "重新生成证书和指纹..."
    gen_cert "$domain"
    restart_tuple
    sleep 2
    set_esim_links "$domain"
    esim_domain="$domain"
    print_nodes
    green "Jetpac eSIM 免流已设置完成，请在客户端更新订阅\n"
}

# ---------- 修改节点配置：辅助 ----------
get_current_uuid() {
    local f="${conf_dir}/inbounds.json" u
    [ -f "$f" ] || return 1
    u=$(jq -r '.inbounds[] | select(.type=="vless") | .users[0].uuid // empty' "$f" 2>/dev/null | head -1)
    [ -z "$u" ] && u=$(jq -r '.inbounds[] | select(.type=="vmess") | .users[0].uuid // empty' "$f" 2>/dev/null | head -1)
    [ -z "$u" ] && u=$(jq -r '.inbounds[] | select(.type=="hysteria2") | .users[0].password // empty' "$f" 2>/dev/null | head -1)
    echo "$u"
}
get_isp() {
    curl -sm 3 -H "User-Agent: Mozilla/5.0" "https://api.ip.sb/geoip" | tr -d '\n' \
      | awk -F\" '{c="";i="";for(x=1;x<=NF;x++){if($x=="country_code")c=$(x+2);if($x=="isp")i=$(x+2)};if(c&&i)print c"-"i}' \
      | sed 's/ /_/g' || echo "Tuple"
}
refresh_sub() {
    base64 -w0 "$client_dir" > "$sub_file" 2>/dev/null || base64 "$client_dir" | tr -d '\n' > "$sub_file"
    chmod 644 "$sub_file"
    # caddy 模式同步到 web 根目录
    if [ "$web_server" = "caddy" ] && [ -n "$sub_path" ]; then
        mkdir -p "${work_dir}/web"
        cp "$sub_file" "${work_dir}/web/${sub_path}" 2>/dev/null
    fi
}
show_urls() { while IFS= read -r l; do [ -n "$l" ] && yellow "$l"; done < "$client_dir"; }

get_quick_tunnel() {
    restart_argo
    yellow "获取临时 Argo 域名中...\n"
    sleep 3
    local f="${work_dir}/argo.log" d=""
    for i in 1 2 3 4 5; do
        [ -f "$f" ] && d=$(sed -n 's|.*https://\([^/]*trycloudflare\.com\).*|\1|p' "$f" | head -1)
        [ -n "$d" ] && break
        sleep 2
    done
    argo_domain="$d"
    green "ArgoDomain: ${PUR}${d}${R}\n"
}
change_argo_domain() {
    [ -z "$argo_domain" ] && return 1
    local uv dec upd enc
    uv=$(grep -m1 -o 'vmess://[^[:space:]]*' "$client_dir")
    [ -z "$uv" ] && return 1
    dec=$(echo "${uv#vmess://}" | base64 -d 2>/dev/null)
    upd=$(echo "$dec" | jq --arg d "$argo_domain" '.host=$d | .sni=$d' 2>/dev/null)
    enc=$(echo "$upd" | base64 -w0)
    sed -i "s|${uv}|vmess://${enc}|" "$client_dir"
    refresh_sub
    green "vmess 节点 Argo 域名已更新\n"
}

# vmess-argo 优选域名
change_cfip() {
    clear
    yellow "修改 vmess-argo 优选域名\n"
    green "1: saas.sin.fan  2: cf.877774.xyz  3: cf.877771.xyz  4: cdns.doon.eu.org  5: cdn.664667.xyz  6: time.is\n"
    local cfip="" cfport="443" inp host port err
    while true; do
        reading "请输入优选域名或IP (1-6 或 域名:端口, 回车默认 1): " inp
        inp=$(printf '%s' "$inp" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
        if [ -z "$inp" ]; then cfip="saas.sin.fan"; cfport="443"; break; fi
        case "$inp" in
            1) cfip="saas.sin.fan"; cfport="443"; break ;;
            2) cfip="cf.877774.xyz"; cfport="443"; break ;;
            3) cfip="cf.877771.xyz"; cfport="443"; break ;;
            4) cfip="cdns.doon.eu.org"; cfport="443"; break ;;
            5) cfip="cdn.664667.xyz"; cfport="443"; break ;;
            6) cfip="time.is"; cfport="443"; break ;;
            *)
                host=""; port="443"; err=0
                if [[ "$inp" =~ ^\[([^]]+)\]:([0-9]+)$ ]]; then
                    host="${BASH_REMATCH[1]}"; port="${BASH_REMATCH[2]}"
                elif [[ "$inp" =~ ^\[([^]]+)\]$ ]]; then
                    host="${BASH_REMATCH[1]}"
                elif [[ "$inp" == *:*:* ]]; then
                    host="$inp"
                elif [[ "$inp" == *:* ]]; then
                    host="${inp%:*}"; port="${inp##*:}"
                else
                    host="$inp"
                fi
                [ -z "$host" ] && { red "域名/IP 不能为空"; err=1; }
                [ $err -eq 0 ] && ! printf '%s' "$host" | grep -Eq '^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^([0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-fA-F]*:[0-9a-fA-F:]*$' && { red "域名/IP 格式不合法: $host"; err=1; }
                if [ $err -eq 0 ] && printf '%s' "$host" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
                    for o in ${host//./ }; do [ "$o" -lt 0 ] || [ "$o" -gt 255 ] && { red "IPv4 不合法: $host"; err=1; break; }; done
                fi
                if [ $err -eq 0 ]; then
                    printf '%s' "$port" | grep -Eq '^[0-9]+$' || { red "端口必须为数字"; err=1; }
                    [ $err -eq 0 ] && { [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; } && { red "端口范围 1-65535"; err=1; }
                fi
                [ $err -eq 1 ] && continue
                cfip="$host"; cfport="$port"; break ;;
        esac
    done
    [ ! -f "$client_dir" ] && { red "未找到 $client_dir"; return 1; }
    local uv dec upd enc
    uv=$(grep -m1 -o 'vmess://[^[:space:]]*' "$client_dir")
    [ -z "$uv" ] && { red "未找到 vmess 节点"; return 1; }
    dec=$(printf '%s' "${uv#vmess://}" | base64 -d 2>/dev/null)
    printf '%s' "$dec" | jq -e . >/dev/null 2>&1 || { red "vmess JSON 解析失败"; return 1; }
    upd=$(printf '%s' "$dec" | jq --arg a "$cfip" --argjson p "$cfport" '.add=$a | .port=$p' 2>/dev/null)
    enc=$(printf '%s' "$upd" | base64 -w0)
    awk -v o="$uv" -v n="vmess://${enc}" '{ while((i=index($0,o))>0) $0=substr($0,1,i-1) n substr($0,i+length(o)); print }' "$client_dir" > "${client_dir}.tmp" && mv "${client_dir}.tmp" "$client_dir"
    refresh_sub
    green "\nvmess 优选域名已更新为: ${PUR}${cfip}:${cfport}${R}\n"
}

# ---------- 修改节点配置 ----------
change_config() {
    check_singbox &>/dev/null
    [ $? -eq 2 ] && { yellow "Tuple 尚未安装！"; sleep 1; menu; return; }
    clear; echo ""
    green "=== 修改节点配置 ===\n"
    green "1. 修改端口"
    skyblue "------------"
    green "2. 修改 UUID"
    skyblue "------------"
    green "3. 修改 Reality 伪装域名"
    skyblue "------------"
    green "4. 添加 hysteria2 端口跳跃"
    skyblue "------------"
    green "5. 删除 hysteria2 端口跳跃"
    skyblue "------------"
    green "6. 修改 vmess-argo 优选域名"
    skyblue "------------"
    green "7. 修改节点 IP 为 IPv4"
    skyblue "------------"
    green "8. 修改节点 IP 为 IPv6"
    skyblue "------------"
    green "9. 一键设置 Jetpac-Esim 免流节点"
    skyblue "------------"
    purple "0. 返回主菜单"
    reading "请输入选择: " choice
    local inf="${conf_dir}/inbounds.json" np typ pr pat
    case "${choice}" in
        1)
            echo ""
            green "1. VLESS-Reality  2. Hysteria2  3. TUIC  4. VMess-Argo  0. 返回"
            reading "请选择要修改的协议: " pc
            case "$pc" in
                1) typ=vless; pr=tcp ;;
                2) typ=hysteria2; pr=udp ;;
                3) typ=tuic; pr=udp ;;
                4) typ=vmess; pr=tcp ;;
                0) change_config; return ;;
                *) red "无效选项"; sleep 1; change_config; return ;;
            esac
            # 通用端口替换：从 @ 起匹配到 ? 前最后一段数字，兼容 IPv4/IPv6 方括号地址
            # hysteria2 端口后为 "/?"，vless/tuic 为 "?"，均保留原分隔符
            pat='s/\(@[^?]*:\)\([0-9]\{1,\}\)\([/?]*[?]\)/\1'"NEED_PORT"'\3/'
            reading "\n请输入 ${typ} 新端口 (回车随机): " np
            [ -z "$np" ] && np=$(shuf -i 20000-65000 -n 1)
            if ! printf '%s' "$np" | grep -Eq '^[0-9]+$' || [ "$np" -lt 1 ] || [ "$np" -gt 65535 ]; then
                red "端口不合法"; sleep 1; change_config; return
            fi
            jq --arg t "$typ" --arg p "$np" '(.inbounds[] | select(.type==$t).listen_port)=($p|tonumber)' "$inf" > "${inf}.tmp" && mv "${inf}.tmp" "$inf"
            allow_port ${np}/${pr} >/dev/null 2>&1
            if [ "$typ" = "vmess" ]; then
                if command_exists rc-service; then
                    sed -i 's|localhost:[0-9]\{1,\}|localhost:'"$np"'|' /etc/init.d/tuple-argo
                else
                    sed -i 's|localhost:[0-9]\{1,\}|localhost:'"$np"'|' /etc/systemd/system/tuple-argo.service
                fi
                get_quick_tunnel; change_argo_domain
            else
                restart_tuple
                p2=${pat/NEED_PORT/$np}
                sed -i "$p2" "$client_dir"
            fi
            refresh_sub; show_urls
            green "\n${typ} 端口已修改为: ${PUR}${np}${R}\n"
            ;;
        2)
            local nu
            reading "\n请输入新的 UUID (回车随机生成): " nu
            [ -z "$nu" ] && nu=$(cat /proc/sys/kernel/random/uuid)
            jq --arg u "$nu" \
               '(.inbounds[] | select(.users != null) | .users[] | select(.uuid != null).uuid)=$u |
                (.inbounds[] | select(.users != null) | .users[] | select(.password != null).password)=$u' \
               "$inf" > "${inf}.tmp" && mv "${inf}.tmp" "$inf"
            restart_tuple
            sed -i -E 's/(vless:\/\/|hysteria2:\/\/)[^@]*(@.*)/\1'"$nu"'\2/' "$client_dir"
            sed -i -E 's#tuic://[^@]*@#tuic://'"$nu"':'"$nu"'@#' "$client_dir"
            local isp vj ve
            isp=$(get_isp)
            [ -f "${work_dir}/argo.log" ] && argo_domain=$(sed -n 's|.*https://\([^/]*trycloudflare\.com\).*|\1|p' "${work_dir}/argo.log" | head -1)
            vj="{\"v\":\"2\",\"ps\":\"${isp}\",\"add\":\"${cf_ip}\",\"port\":\"${cf_port}\",\"id\":\"${nu}\",\"aid\":\"0\",\"scy\":\"auto\",\"net\":\"ws\",\"type\":\"none\",\"host\":\"${argo_domain}\",\"path\":\"/vmess-argo?ed=2560\",\"tls\":\"tls\",\"sni\":\"${argo_domain}\",\"alpn\":\"\",\"fp\":\"firefox\",\"allowInsecure\":\"false\"}"
            ve=$(echo "$vj" | base64 -w0)
            sed -i -E '/vmess:\/\//{s@vmess://.*@vmess://'"$ve"'@}' "$client_dir"
            refresh_sub; show_urls
            green "\nUUID 已修改为: ${PUR}${nu}${R}\n"
            ;;
        3)
            clear
            green "\n1. www.joom.com\n2. www.stengg.com\n3. www.wedgehr.com\n4. www.cerebrium.ai\n5. www.nazhumi.com\n"
            local ns
            reading "\n请输入新的 Reality 伪装域名 (回车默认 1): " ns
            case "$ns" in
                ""|1) ns="www.joom.com" ;;
                2) ns="www.stengg.com" ;;
                3) ns="www.wedgehr.com" ;;
                4) ns="www.cerebrium.ai" ;;
                5) ns="www.nazhumi.com" ;;
            esac
            jq --arg s "$ns" \
               '(.inbounds[] | select(.type=="vless") | .tls.server_name)=$s |
                (.inbounds[] | select(.type=="vless") | .tls.reality.handshake.server)=$s' \
               "$inf" > "${inf}.tmp" && mv "${inf}.tmp" "$inf"
            restart_tuple
            sed -i "s/\(vless:\/\/[^\?]*\?\([^\&]*\&\)*sni=\)[^&]*/\1$ns/" "$client_dir"
            refresh_sub; show_urls
            green "\nReality sni 已修改为: ${PUR}${ns}${R}\n"
            ;;
        4)
            purple "端口跳跃需确保区间端口未被占用\n"
            local mn mx lp
            reading "请输入跳跃起始端口 (回车随机): " mn
            [ -z "$mn" ] && mn=$(shuf -i 50000-60000 -n 1)
            reading "请输入跳跃结束端口 (回车默认起始+100): " mx
            [ -z "$mx" ] && mx=$((mn + 100))
            lp=$(jq -r '.inbounds[] | select(.type=="hysteria2").listen_port' "$inf")
            iptables -t nat -A PREROUTING -p udp --dport ${mn}:${mx} -j DNAT --to-destination :$lp >/dev/null 2>&1
            command -v ip6tables >/dev/null 2>&1 && ip6tables -t nat -A PREROUTING -p udp --dport ${mn}:${mx} -j DNAT --to-destination :$lp >/dev/null 2>&1
            if command_exists rc-service; then
                iptables-save > /etc/iptables/rules.v4 2>/dev/null
                command -v ip6tables >/dev/null 2>&1 && ip6tables-save > /etc/iptables/rules.v6 2>/dev/null
                cat > /etc/init.d/iptables << 'IEOF'
#!/sbin/openrc-run
depend() { need net; }
start() {
    [ -f /etc/iptables/rules.v4 ] && iptables-restore < /etc/iptables/rules.v4
    command -v ip6tables >/dev/null 2>&1 && [ -f /etc/iptables/rules.v6 ] && ip6tables-restore < /etc/iptables/rules.v6
}
IEOF
                chmod +x /etc/init.d/iptables && rc-update add iptables default >/dev/null 2>&1 && /etc/init.d/iptables start >/dev/null 2>&1
            elif [ -f /etc/debian_version ]; then
                DEBIAN_FRONTEND=noninteractive apt install -y iptables-persistent >/dev/null 2>&1 && netfilter-persistent save >/dev/null 2>&1
                systemctl enable --now netfilter-persistent >/dev/null 2>&1
            elif [ -f /etc/redhat-release ]; then
                manage_packages_install_iptables
            fi
            restart_tuple
            local ip fp hu ln isp
            ip=$(get_realip)
            fp=$(openssl x509 -noout -fingerprint -sha256 -in "${work_dir}/cert.pem" | cut -d'=' -f2 | sed 's/:/%3A/g')
            hu=$(sed -n 's/.*hysteria2:\/\/\([^@]*\)@.*/\1/p' "$client_dir")
            ln=$(grep -n 'hysteria2://' "$client_dir" | cut -d':' -f1)
            isp=$(get_isp)
            sed -i.bak "/hysteria2:/d" "$client_dir"
            sed -i "${ln}i hysteria2://${hu}@${ip}:${lp}?peer=${tls_sni}&insecure=1&pinSHA256=${fp}&alpn=h3&obfs=none&mport=${lp},${mn}-${mx}#${isp}" "$client_dir"
            refresh_sub; show_urls
            green "\nhysteria2 端口跳跃已开启: ${PUR}${mn}-${mx}${R}\n"
            ;;
        5)
            iptables -t nat -F PREROUTING >/dev/null 2>&1
            command -v ip6tables >/dev/null 2>&1 && ip6tables -t nat -F PREROUTING >/dev/null 2>&1
            if command_exists rc-service; then
                rc-update del iptables default >/dev/null 2>&1; rm -f /etc/init.d/iptables
            elif [ -f /etc/debian_version ]; then netfilter-persistent save >/dev/null 2>&1
            elif [ -f /etc/redhat-release ]; then service iptables save >/dev/null 2>&1; command -v ip6tables >/dev/null 2>&1 && service ip6tables save >/dev/null 2>&1; fi
            sed -i '/hysteria2/s/&mport=[^#&]*//g' "$client_dir"
            refresh_sub
            green "\n端口跳跃已删除\n"
            ;;
        6) change_cfip ;;
        7)
            local v4
            [ -f "$client_dir" ] || { red "未找到 $client_dir"; return 1; }
            v4=$(curl -4 -sm 2 ip.sb)
            printf '%s' "$v4" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || { red "获取 IPv4 失败: $v4"; return 1; }
            curl -4 -sm 2 http://ipinfo.io/org | grep -qE 'Cloudflare|UnReal|AEZA|Andrei' && { red "当前 IPv4 为 WARP IP，不能作为直连节点"; return 1; }
            if grep -Eq '^(vless|hysteria2|tuic)://[^@]+@\[[0-9a-fA-F:]+\]' "$client_dir"; then
                sed -i -E "/^(vless|hysteria2|tuic):\/\// s#@\[[0-9a-fA-F:]+\]#@${v4}#g" "$client_dir"
                green "\n已切换为 IPv4: $v4\n"; echo "v4" > "$ip_mode_file"; refresh_sub; show_urls; print_nodes
            else yellow "\n当前已是 IPv4，无需切换\n"; echo "v4" > "$ip_mode_file"; fi
            ;;
        8)
            local v6
            [ -f "$client_dir" ] || { red "未找到 $client_dir"; return 1; }
            v6=$(curl -6 -sm 3 ip.sb)
            printf '%s' "$v6" | grep -Eq '^[0-9a-fA-F:]+$' || { red "当前服务器没有可用 IPv6"; return 1; }
            curl -6 -sm 2 http://ipinfo.io/org | grep -qE 'Cloudflare|UnReal|AEZA|Andrei' && { red "当前 IPv6 为 WARP IP，不能作为直连节点"; return 1; }
            if grep -Eq '^(vless|hysteria2|tuic)://[^@]+@([0-9]{1,3}\.){3}[0-9]{1,3}' "$client_dir"; then
                sed -i -E "/^(vless|hysteria2|tuic):\/\// s#@(([0-9]{1,3}\.){3}[0-9]{1,3})#@[${v6}]#g" "$client_dir"
                green "\n已切换为 IPv6: [${v6}]\n"; echo "v6" > "$ip_mode_file"; refresh_sub; show_urls; print_nodes
            else yellow "\n当前已是 IPv6，无需切换\n"; echo "v6" > "$ip_mode_file"; fi
            ;;
        9) set_jetpac_esim ;;
        0) menu ;;
        *) red "无效的选项！" ;;
    esac
}

manage_packages_install_iptables() {
    if command_exists apt; then
        DEBIAN_FRONTEND=noninteractive apt install -y iptables-persistent >/dev/null 2>&1 && netfilter-persistent save >/dev/null 2>&1
        systemctl enable --now netfilter-persistent >/dev/null 2>&1
    elif command_exists dnf || command_exists yum; then
        dnf install -y iptables-services >/dev/null 2>&1 || yum install -y iptables-services >/dev/null 2>&1
        service iptables save >/dev/null 2>&1
        systemctl enable --now iptables >/dev/null 2>&1
        command -v ip6tables >/dev/null 2>&1 && { service ip6tables save >/dev/null 2>&1; systemctl enable --now ip6tables >/dev/null 2>&1; }
    fi
}

# ---------- 一键安装 ----------
onekey_install() {
    check_root
    if [ -x "${work_dir}/sing-box" ]; then
        yellow "检测到 Tuple 已安装，跳过安装。如需重装请先执行 -u 卸载\n"
        return 0
    fi
    install_deps
    install_tuple
    # 落盘 IP 模式，保证 -c/-e 独立运行时策略一致
    mkdir -p "$work_dir"
    echo "$ip_mode" > "$ip_mode_file"
    echo "$web_server" > "$web_mode_file"
    install_services
    sleep 4
    get_info
    add_nginx_conf
    if [ -f "$0" ]; then
        cp "$0" "${work_dir}/tuple.sh"
        chmod +x "${work_dir}/tuple.sh"
        ln -sf "${work_dir}/tuple.sh" /usr/bin/tuple
        green "快捷指令 tuple 已创建\n"
    fi
    green "\nTuple 四协议节点搭建完成\n"
}

# ---------- 卸载 ----------
uninstall_all() {
    check_root
    yellow "正在卸载 Tuple...\n"
    service_ctl tuple stop; service_ctl tuple-argo stop
    if command_exists rc-service; then
        rc-update del tuple default >/dev/null 2>&1
        rc-update del tuple-argo default >/dev/null 2>&1
        rm -f /etc/init.d/tuple /etc/init.d/tuple-argo
    else
        systemctl disable --now tuple tuple-argo >/dev/null 2>&1
        rm -f /etc/systemd/system/tuple.service /etc/systemd/system/tuple-argo.service
        systemctl daemon-reload >/dev/null 2>&1
    fi
    local web_conf=""
    if [ "$web_server" = "caddy" ]; then
        web_conf="/etc/caddy/Caddyfile"
        service_ctl caddy stop >/dev/null 2>&1
        rm -f "$web_conf" "${web_conf}.bak"
    else
        local nd="/etc/nginx/conf.d"
        command_exists apk && nd="/etc/nginx/http.d"
        rm -f /etc/nginx/conf.d/tuple.conf /etc/nginx/conf.d/tuple.conf.bak
        rm -f "${nd}/tuple.conf" "${nd}/tuple.conf.bak"
        service_ctl nginx restart >/dev/null 2>&1
    fi
    rm -rf "$work_dir" /usr/bin/tuple
    green "Tuple 已卸载\n"
}

# ---------- 菜单 ----------
menu() {
    clear; echo ""
    purple "=== Tuple · 四协议一键脚本 ===\n"
    local ws_label; [ "$web_server" = "caddy" ] && ws_label="Caddy" || ws_label="Nginx"
    echo -e "sing-box: $(check_singbox)  |  Argo: $(check_argo)  |  ${ws_label}: $(check_web)\n"
    echo -e "IP模式: ${PUR}${ip_mode}${R}  Web: ${PUR}${web_server}${R}  (可用 IP_MODE=v4/v6/auto、WEB=nginx/caddy 覆盖)\n"
    green "1. 一键搭建四协议节点"
    green "2. 设置 Jetpac eSIM 免流"
    green "3. 查看节点与订阅链接"
    green "4. 修改节点配置"
    red   "5. 卸载 Tuple"
    purple "0. 退出"
}
trap 'red "\n强制退出"; exit' INT

case "$1" in
    -i|--install) onekey_install ;;
    -c|--check)   check_singbox &>/dev/null || { red "Tuple 尚未安装"; exit 1; }; print_nodes ;;
    -e|--esim)    set_jetpac_esim ;;
    -u|--uninstall) uninstall_all ;;
    -h|--help)
        echo ""
        green "用法: bash Tuple.sh [参数]"
        green "  -i, --install    一键安装四协议节点"
        green "  -c, --check      查看节点与订阅"
        green "  -e, --esim       设置 Jetpac eSIM 免流"
        green "  -u, --uninstall  卸载"
        green "  -h, --help       帮助"
        green "  无参数           进入交互菜单"
        echo ""
        green "环境变量:"
        green "  IP_MODE=v4|v6|auto   节点与订阅使用的 IP (默认 v4)"
        green "  WEB=nginx|caddy      订阅 Web 服务 (默认 nginx)"
        green "  PORT=端口            VLESS-Reality 端口 (默认随机)"
        echo "" ;;
    "")
        while true; do
            menu
            reading "请选择 (0-5): " c
            case "$c" in
                1) onekey_install ;;
                2) set_jetpac_esim ;;
                3) print_nodes ;;
                4) change_config ;;
                5) uninstall_all; exit 0 ;;
                0) exit 0 ;;
                *) red "无效选项" ;;
            esac
            read -n 1 -s -r -p $'\n按任意键返回...'
        done ;;
    *) red "未知参数: $1"; exit 1 ;;
esac
