import { connect } from 'cloudflare:sockets';

let proxyIP = '13.230.34.30';  // proxyIP
let customID = 'xxxxxxx';  // 自定义别名（用于访问订阅页与订阅接口），可以自定义不是非必须UUID
let password = 'xxxxxxx'  // 用于访问/sub/xx 的验证密码
let s = 'sub’ // 订阅地址访问前缀   https://workerdomain/s/customID 填入自定义的值

// CDN
let cfip = [
    'mfa.gov.ua', 'saas.sin.fan', 'store.ubi.com','cf.130519.xyz','cf.008500.xyz', 
    'cf.090227.xyz', 'cf.877774.xyz','cdns.doon.eu.org','sub.danfeng.eu.org','cf.zhetengsha.eu.org'
];  // 在此感谢各位大佬维护的优选域名

function getSubPageHTML(currentDomain, pageId) {
    const pageKey = pageId || customID;
    const v2raySubLink = `https://${currentDomain}/sub/${pageKey}`;
    const clashSubLink = `https://sublink.eooce.com/clash?config=https://${currentDomain}/sub/${pageKey}`;
    const singboxSubLink = `https://sublink.eooce.com/singbox?config=https://${currentDomain}/sub/${pageKey}`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>啊啊啊啊哈哈哈哈哈</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#18800e 100%);min-height:100vh;padding:20px}.container{max-width:900px;margin:0 auto;background:#fff;border-radius:15px;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,.3)}h1{color:#667eea;margin-bottom:10px;font-size:2rem;text-align:center}.section{margin-bottom:25px}.section-title{color:#667eea;font-size:16px;font-weight:600;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #667eea}.link-box{background:#f7f9fc;border:1px solid #e1e8ed;border-radius:8px;padding:12px;margin-bottom:10px}.link-label{font-size:16px;color:#666;margin-bottom:6px;font-weight:700}.link-content{display:flex;gap:8px}.link-text{flex:1;background:#fff;padding:8px 12px;border-radius:5px;border:1px solid #ddd;font-size:.8rem;word-break:break-all;font-family:monospace}.copy-btn{background:#667eea;color:#fff;border:none;padding:8px 16px;border-radius:5px;cursor:pointer;font-size:13px;white-space:nowrap}.copy-btn:hover{background:#5568d3}.copy-btn.copied{background:#48c774}.usage-section{background:#fff9e6;border-left:4px solid #ffc107;padding:15px;border-radius:5px;margin-top:25px}.usage-title{color:#f57c00;font-size:1.2rem;font-weight:600;margin-bottom:12px}.usage-item{margin-bottom:12px;font-size:13px;line-height:1.6}.usage-item strong{color:#333;display:block;margin-bottom:4px}.usage-item code{background:#fff;padding:2px 6px;border-radius:3px;color:#e91e63;font-size:13px;border:1px solid #ddd;word-wrap:break-word;word-break:break-all;display:inline-block;max-width:100%}.example{color:#666;font-size:14px;margin-left:8px}.footer{margin-top:30px;padding-top:20px;border-top:1px solid #e1e8ed;text-align:center;font-size:14px;color:#999}.footer a{color:#667eea;text-decoration:none;margin:0 10px}.footer a:hover{text-decoration:underline}.password-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999}.password-modal{background:#fff;padding:40px;border-radius:15px;box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:center;max-width:400px;width:90%}.password-modal h2{color:#667eea;margin-bottom:20px;font-size:1.5rem}.password-input{width:100%;padding:12px;border:2px solid #e1e8ed;border-radius:8px;font-size:16px;margin-bottom:20px;outline:none}.password-input:focus{border-color:#667eea}.password-btn{background:#667eea;color:#fff;border:none;padding:12px 30px;border-radius:8px;cursor:pointer;font-size:16px;width:100%}.password-btn:hover{background:#5568d3}.password-error{color:#e74c3c;margin-top:10px;font-size:14px;display:none}.content{display:none}@media (max-width:768px){.container{padding:20px}.link-content{flex-direction:column}.copy-btn{width:100%}.password-modal{padding:30px}}</style></head><body><div class="password-overlay" id="passwordOverlay"><div class="password-modal"><h2>🔐 访问验证</h2><p style="color:#666;margin-bottom:20px;">请输入访问密码</p><input type="password" class="password-input" id="passwordInput" placeholder="请输入密码" autocomplete="off"><button class="password-btn" onclick="verifyPassword()">验证</button><div class="password-error" id="passwordError">密码错误，请重试</div></div></div><div class="content" id="mainContent"><div class="container"><h1>Snippets 订阅中心</h1><div class="section"><div class="section-title">🔗 通用订阅</div><div class="link-box"><div class="link-label">v2rayN / Loon / Shadowrocket / Karing</div><div class="link-content"><div class="link-text" id="v2ray-link">${v2raySubLink}</div><button class="copy-btn" onclick="copyToClipboard('v2ray-link',this)">复制</button></div></div></div><div class="section"><div class="section-title">😺 Clash 系列订阅</div><div class="link-box"><div class="link-label">Mihomo / FlClash / Clash Meta</div><div class="link-content"><div class="link-text" id="clash-link">${clashSubLink}</div><button class="copy-btn" onclick="copyToClipboard('clash-link',this)">复制</button></div></div></div><div class="section"><div class="section-title">📦 Sing-box 系列订阅</div><div class="link-box"><div class="link-label">Sing-box / SFI / SFA</div><div class="link-content"><div class="link-text" id="singbox-link">${singboxSubLink}</div><button class="copy-btn" onclick="copyToClipboard('singbox-link',this)">复制</button></div></div></div><div class="usage-section"><div class="usage-title">⚙️ 自定义路径(节点里的path)使用说明</div><div class="usage-item"><strong>1. 默认路径</strong><code>/?ed=2560</code><div class="example">使用代码里设置的默认proxyip</div></div><div class="usage-item"><strong>2. 带端口的proxyip</strong><code>/?ed=2560&proxyip=210.61.97.241:81</code><br><code>/?ed=2560&proxyip=proxy.xxxxxxxx.tk:50001</code></div><div class="usage-item"><strong>3. 域名proxyip</strong><code>/?ed=2560&proxyip=ProxyIP.SG.CMLiussss.net</code></div><div class="usage-item"><strong>4. 全局SOCKS5</strong><code>/?ed=2560&proxyip=socks://host:port</code><br><code>/?ed=2560&proxyip=socks5://host:port</code><br><code>/?ed=2560&proxyip=socks://user:password@host:port</code><br><code>/?ed=2560&proxyip=socks5://user:password@host:port</code></div><div class="usage-item"><strong>5. 全局HTTP/HTTPS</strong><code>/?ed=2560&proxyip=http://host:port</code><br><code>/?ed=2560&proxyip=https://host:port</code><br><code>/?ed=2560&proxyip=http://user:password@host:port</code><br><code>/?ed=2560&proxyip=https://user:password@host:port</code></div></div></div></div><script>const correctPassword='${password}';function verifyPassword(){const inputPassword=document.getElementById('passwordInput').value;const errorDiv=document.getElementById('passwordError');if(inputPassword===correctPassword){document.getElementById('passwordOverlay').style.display='none';document.getElementById('mainContent').style.display='block';sessionStorage.setItem('authenticated','true')}else{errorDiv.style.display='block';document.getElementById('passwordInput').value='';setTimeout(()=>{errorDiv.style.display='none'},3000)}}document.getElementById('passwordInput').addEventListener('keypress',function(e){if(e.key==='Enter'){verifyPassword()}});window.addEventListener('load',function(){if(sessionStorage.getItem('authenticated')==='true'){document.getElementById('passwordOverlay').style.display='none';document.getElementById('mainContent').style.display='block'}});function copyToClipboard(e,t){const n=document.getElementById(e).textContent;navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(n).then(()=>{showCopySuccess(t)}).catch(()=>{fallbackCopy(n,t)}):fallbackCopy(n,t)}function fallbackCopy(e,t){const n=document.createElement("textarea");n.value=e,n.style.position="fixed",n.style.left="-999999px",document.body.appendChild(n),n.select();try{document.execCommand("copy"),showCopySuccess(t)}catch(e){alert("复制失败，请手动复制")}document.body.removeChild(n)}function showCopySuccess(e){const t=e.textContent;e.textContent="已复制",e.classList.add("copied"),setTimeout(()=>{e.textContent=t,e.classList.remove("copied")},2e3)}</script></body></html>`;
}

async function handleHomePage(request) {
    const url = new URL(request.url);
    // const currentDomain = url.hostname;
    return new Response(`<h1>Hello xxxxxxxx</h1>`, {
        headers: { 
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
    });
}

async function handleSubtionPage(request, pageId) {
    const url = new URL(request.url);
    const currentDomain = url.hostname;
    return new Response(getSubPageHTML(currentDomain, pageId), {
        headers: { 
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
    });
}

function formatIdentifier(arr, offset = 0) {
    const hex = [...arr.slice(offset, offset + 16)].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.substring(0,8)}-${hex.substring(8,12)}-${hex.substring(12,16)}-${hex.substring(16,20)}-${hex.substring(20)}`;
}

function isValidUUIDString(str) {
    return typeof str === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
}

// 生成稳定的 16 字节标识（非安全哈希，仅用于协议内标识占位）
function compute16BytesFromString(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input || '');
    let h1 = 0x811c9dc5; // FNV-1a 32-bit 起始值
    let h2 = 0x811c9dc5;
    let h3 = 0x811c9dc5;
    let h4 = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) {
        const c = data[i];
        h1 ^= c; h1 = (h1 * 0x01000193) >>> 0;
        h2 ^= (c ^ (i & 0xff)); h2 = (h2 * 0x01000193) >>> 0;
        h3 ^= (c ^ ((i * 131) & 0xff)); h3 = (h3 * 0x01000193) >>> 0;
        h4 ^= (c ^ ((i * 17) & 0xff)); h4 = (h4 * 0x01000193) >>> 0;
    }
    const out = new Uint8Array(16);
    new DataView(out.buffer).setUint32(0, h1);
    new DataView(out.buffer).setUint32(4, h2);
    new DataView(out.buffer).setUint32(8, h3);
    new DataView(out.buffer).setUint32(12, h4);
    return out;
}

function getEffectiveUUIDString() {
    if (customID && isValidUUIDString(customID)) {
        return customID.toLowerCase();
    }
    if (customID && customID.trim().length > 0) {
        const bytes = compute16BytesFromString(customID.trim());
        return formatIdentifier(bytes);
    }
    return null;
}

function base64ToArray(b64Str) {
    if (!b64Str) return { error: null };
    try { 
        const binaryString = atob(b64Str.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return { earlyData: bytes.buffer, error: null }; 
    } catch (error) { 
        return { error }; 
    }
}

function closeSocketQuietly(socket) { 
    try { 
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) {
            socket.close(); 
        }
    } catch (error) {} 
}

function parseProxyAddress(proxyStr) {
    if (!proxyStr) return null;
    
    proxyStr = proxyStr.trim();
    // 解析 S5 代理: socks://user:pass@host:port
    if (proxyStr.startsWith('socks://') || proxyStr.startsWith('socks5://')) {
        const urlStr = proxyStr.replace(/^socks:\/\//, 'socks5://');
        try {
            const url = new URL(urlStr);
            return {
                type: 'socks5',
                host: url.hostname,
                port: parseInt(url.port) || 1080,
                username: url.username ? decodeURIComponent(url.username) : '',
                password: url.password ? decodeURIComponent(url.password) : ''
            };
        } catch (e) {
            // console.error('Failed to parse SOCKS URL:', e);
            return null;
        }
    }
    
    // 解析 HTTP 代理: http://user:pass@host:port
    if (proxyStr.startsWith('http://') || proxyStr.startsWith('https://')) {
        try {
            const url = new URL(proxyStr);
            return {
                type: 'http',
                host: url.hostname,
                port: parseInt(url.port) || (proxyStr.startsWith('https://') ? 443 : 80),
                username: url.username ? decodeURIComponent(url.username) : '',
                password: url.password ? decodeURIComponent(url.password) : ''
            };
        } catch (e) {
            // console.error('Failed to parse HTTP URL:', e);
            return null;
        }
    }
    
    // 处理 IPv6 地址格式 [host]:port
    if (proxyStr.startsWith('[')) {
        const closeBracket = proxyStr.indexOf(']');
        if (closeBracket > 0) {
            const host = proxyStr.substring(1, closeBracket);
            const rest = proxyStr.substring(closeBracket + 1);
            if (rest.startsWith(':')) {
                const port = parseInt(rest.substring(1), 10);
                if (!isNaN(port) && port > 0 && port <= 65535) {
                    return { type: 'direct', host, port };
                }
            }
            return { type: 'direct', host, port: 443 };
        }
    }
    
    const lastColonIndex = proxyStr.lastIndexOf(':');
    
    if (lastColonIndex > 0) {
        const host = proxyStr.substring(0, lastColonIndex);
        const portStr = proxyStr.substring(lastColonIndex + 1);
        const port = parseInt(portStr, 10);
        
        if (!isNaN(port) && port > 0 && port <= 65535) {
            return { type: 'direct', host, port };
        }
    }
    
    return { type: 'direct', host: proxyStr, port: 443 };
}

export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);
            const pathname = url.pathname;
            if (pathname.startsWith('/proxyip=')) {
                const newProxyIP = decodeURIComponent(pathname.substring(9)).trim();
                if (newProxyIP) {
                    proxyIP = newProxyIP;
                    return new Response(`set proxyIP to: ${proxyIP}\n\n`, {
                        headers: { 
                            'Content-Type': 'text/plain; charset=utf-8',
                            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                        },
                    });
                }
            }

            if (request.headers.get('Upgrade') === 'websocket') {
                const customProxyIP = url.searchParams.get('proxyip');
                return await handleWsRequest(request, customProxyIP);
            } else if (request.method === 'GET') {
                if (url.pathname === '/') {
                    return handleHomePage(request);
                }
                
                if (customID && url.pathname === `/${customID}`) {
                    return handleSubtionPage(request, customID);
                }
                
                if (customID && url.pathname.toLowerCase().includes(`/${s}/${customID.toLowerCase()}`)) {
                    const currentDomain = url.hostname;
                    const header = 'v' + 'l' + 'e' + 's' + 's';
                    const effectiveUUID = getEffectiveUUIDString();
                    const fallbackFlags = ['🇺🇸','🇯🇵','🇬🇧','🇨🇦','🇩🇪','🇫🇷','🇰🇷','🇸🇬','🇦🇺','🇳🇿','🇮🇳','🇧🇷','🇳🇱','🇸🇪','🇮🇹','🇪🇸','🇲🇽','🇿🇦'];
                    const nodeLinks = await Promise.all(cfip.map(async (cdn) => {
                        const flag = fallbackFlags[Math.floor(Math.random() * fallbackFlags.length)];
                        return `${header}://${effectiveUUID}@${cdn}:443?encryption=none&security=tls&sni=${currentDomain}&fp=firefox&allowInsecure=1&type=ws&host=${currentDomain}&path=%2F%3Fed%3D2560#${flag}sni-${cdn}`;
                    }));
                    
                    const linksText = nodeLinks.join('\n');
                    const base64Content = btoa(unescape(encodeURIComponent(linksText)));
                    
                    return new Response(base64Content, {
                        headers: { 
                            'Content-Type': 'text/plain; charset=utf-8',
                            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                        },
                    });
                }
            }
            return new Response('Not Found', { status: 404 });
        } catch (err) {
            // console.error('Error:', err);
            return new Response('Internal Server Error', { status: 500 });
        }
    },
};

async function handleWsRequest(request, customProxyIP) {
    const wsPair = new WebSocketPair();
    const [clientSock, serverSock] = Object.values(wsPair);
    serverSock.accept();

    let remoteConnWrapper = { socket: null };
    let isDnsQuery = false;

    const earlyData = request.headers.get('sec-websocket-protocol') || '';
    const readable = makeReadableStream(serverSock, earlyData);

    readable.pipeTo(new WritableStream({
        async write(chunk) {
            if (isDnsQuery) return await forwardUDP(chunk, serverSock, null);
            if (remoteConnWrapper.socket) {
                const writer = remoteConnWrapper.socket.writable.getWriter();
                await writer.write(chunk);
                writer.releaseLock();
                return;
            }
            const effectiveUUID = getEffectiveUUIDString();
            const { hasError, message, addressType, port, hostname, rawIndex, version, isUDP } = parseWsPacketHeader(chunk, effectiveUUID);
            if (hasError) throw new Error(message);

            if (isUDP) {
                if (port === 53) isDnsQuery = true;
                else throw new Error('UDP is not supported');
            }
            const respHeader = new Uint8Array([version[0], 0]);
            const rawData = chunk.slice(rawIndex);
            if (isDnsQuery) return forwardUDP(rawData, serverSock, respHeader);
            await forwardTCP(addressType, hostname, port, rawData, serverSock, respHeader, remoteConnWrapper, customProxyIP);
        },
    })).catch((err) => {
        // console.error('Readable pipe error:', err);
    });

    return new Response(null, { status: 101, webSocket: clientSock });
}

async function connectViaSocks5(proxyConfig, targetHost, targetPort, initialData) {
    const { host, port, username, password } = proxyConfig;
    // console.log(`Connecting via S5: ${host}:${port} -> ${targetHost}:${targetPort}`);
    const socket = connect({ hostname: host, port: port });
    const writer = socket.writable.getWriter();
    const reader = socket.readable.getReader();
    
    try {
        const authMethods = username && password ? 
            new Uint8Array([0x05, 0x02, 0x00, 0x02]) :
            new Uint8Array([0x05, 0x01, 0x00]); 
        
        await writer.write(authMethods);
        const methodResponse = await reader.read();
        if (methodResponse.done || methodResponse.value.byteLength < 2) {
            throw new Error('S5 method selection failed');
        }
        
        const selectedMethod = new Uint8Array(methodResponse.value)[1];
        if (selectedMethod === 0x02) {
            if (!username || !password) {
                throw new Error('S5 requires authentication');
            }
            
            const userBytes = new TextEncoder().encode(username);
            const passBytes = new TextEncoder().encode(password);
            const authPacket = new Uint8Array(3 + userBytes.length + passBytes.length);
            authPacket[0] = 0x01; 
            authPacket[1] = userBytes.length;
            authPacket.set(userBytes, 2);
            authPacket[2 + userBytes.length] = passBytes.length;
            authPacket.set(passBytes, 3 + userBytes.length);
            await writer.write(authPacket);
            const authResponse = await reader.read();
            if (authResponse.done || new Uint8Array(authResponse.value)[1] !== 0x00) {
                throw new Error('S5 authentication failed');
            }
        } else if (selectedMethod !== 0x00) {
            throw new Error(`S5 unsupported auth method: ${selectedMethod}`);
        }
        
        const hostBytes = new TextEncoder().encode(targetHost);
        const connectPacket = new Uint8Array(7 + hostBytes.length);
        connectPacket[0] = 0x05;
        connectPacket[1] = 0x01;
        connectPacket[2] = 0x00; 
        connectPacket[3] = 0x03; 
        connectPacket[4] = hostBytes.length;
        connectPacket.set(hostBytes, 5);
        new DataView(connectPacket.buffer).setUint16(5 + hostBytes.length, targetPort, false);
        await writer.write(connectPacket);
        const connectResponse = await reader.read();
        if (connectResponse.done || new Uint8Array(connectResponse.value)[1] !== 0x00) {
            throw new Error('S5 connection failed');
        }
        
        await writer.write(initialData);
        writer.releaseLock();
        reader.releaseLock();
        return socket;
    } catch (error) {
        writer.releaseLock();
        reader.releaseLock();
        throw error;
    }
}

async function connectViaHttp(proxyConfig, targetHost, targetPort, initialData) {
    const { host, port, username, password } = proxyConfig;
    // console.log(`Connecting via HTTP: ${host}:${port} -> ${targetHost}:${targetPort}`);
    const socket = connect({ hostname: host, port: port });
    const writer = socket.writable.getWriter();
    const reader = socket.readable.getReader();
    
    try {
        let connectRequest = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n`;
        connectRequest += `Host: ${targetHost}:${targetPort}\r\n`;
        if (username && password) {
            const auth = btoa(`${username}:${password}`);
            connectRequest += `Authorization: Basic ${auth}\r\n`;
        }
        
        connectRequest += '\r\n';
        await writer.write(new TextEncoder().encode(connectRequest));
        let responseData = new Uint8Array(0);
        let headerComplete = false;
        
        while (!headerComplete) {
            const chunk = await reader.read();
            if (chunk.done) {
                throw new Error('HTTP connection closed unexpectedly');
            }
            
            const newData = new Uint8Array(responseData.length + chunk.value.byteLength);
            newData.set(responseData);
            newData.set(new Uint8Array(chunk.value), responseData.length);
            responseData = newData;
            const responseText = new TextDecoder().decode(responseData);
            if (responseText.includes('\r\n\r\n')) {
                headerComplete = true;
            }
        }
        
        const responseText = new TextDecoder().decode(responseData);
        if (!responseText.startsWith('HTTP/1.1 200') && !responseText.startsWith('HTTP/1.0 200')) {
            throw new Error(`HTTP connection failed: ${responseText.split('\r\n')[0]}`);
        }
        
        await writer.write(initialData);
        writer.releaseLock();
        reader.releaseLock();
        return socket;
    } catch (error) {
        writer.releaseLock();
        reader.releaseLock();
        throw error;
    }
}

async function forwardTCP(addrType, host, portNum, rawData, ws, respHeader, remoteConnWrapper, customProxyIP) {
    async function connectDirect(address, port, data) {
        // console.log(`Direct connecting to ${address}:${port}`);
        const remoteSock = connect({ hostname: address, port: port });
        const writer = remoteSock.writable.getWriter();
        await writer.write(data);
        writer.releaseLock();
        return remoteSock;
    }
    
    let proxyConfig = null;
    let shouldUseProxy = false;
    if (customProxyIP) {
        proxyConfig = parseProxyAddress(customProxyIP);
        if (proxyConfig && (proxyConfig.type === 'socks5' || proxyConfig.type === 'http')) {
            shouldUseProxy = true;
            // console.log(`Using custom proxy (${proxyConfig.type}): ${proxyConfig.host}:${proxyConfig.port}`);
        } else if (!proxyConfig) {
            proxyConfig = parseProxyAddress(proxyIP) || { type: 'direct', host: proxyIP, port: 443 };
            // console.log(`Custom proxy parse failed, using default: ${proxyConfig.host}:${proxyConfig.port}`);
        }
    } else {
        // 使用默认代理
        proxyConfig = parseProxyAddress(proxyIP) || { type: 'direct', host: proxyIP, port: 443 };
        if (proxyConfig.type === 'socks5' || proxyConfig.type === 'http') {
            shouldUseProxy = true;
        }
        // console.log(`Using default proxy (${proxyConfig.type}): ${proxyConfig.host}:${proxyConfig.port}`);
    }
    
    async function connectWithProxy() {
        let newSocket;
        if (proxyConfig.type === 'socks5') {
            newSocket = await connectViaSocks5(proxyConfig, host, portNum, rawData);
        } else if (proxyConfig.type === 'http') {
            newSocket = await connectViaHttp(proxyConfig, host, portNum, rawData);
        } else {
            newSocket = await connectDirect(proxyConfig.host, proxyConfig.port, rawData);
        }
        
        remoteConnWrapper.socket = newSocket;
        newSocket.closed.catch(() => {}).finally(() => closeSocketQuietly(ws));
        connectStreams(newSocket, ws, respHeader, null);
    }
    
    // 如果配置了S5或HTTP代理，直接使用代理连接
    if (shouldUseProxy) {
        try {
            await connectWithProxy();
        } catch (err) {
            // console.log('Proxy connection failed:', err.message);
            throw err;
        }
    } else {
        // 否则先尝试直连，失败后使用代理
        try {
            const initialSocket = await connectDirect(host, portNum, rawData);
            remoteConnWrapper.socket = initialSocket;
            connectStreams(initialSocket, ws, respHeader, connectWithProxy);
        } catch (err) {
            // console.log('Direct connection failed, retrying with proxy:', err.message);
            await connectWithProxy();
        }
    }
}

function parseWsPacketHeader(chunk, tokens) {
    if (chunk.byteLength < 24) return { hasError: true, message: 'Invalid data' };
    const version = new Uint8Array(chunk.slice(0, 1));
    const incomingId = formatIdentifier(new Uint8Array(chunk.slice(1, 17)));
    const tokenList = Array.isArray(tokens) ? tokens : [tokens];
    const ok = tokenList.some(t => typeof t === 'string' && t.toLowerCase() === incomingId.toLowerCase());
    if (!ok) return { hasError: true, message: 'Invalid uuid' };
    const optLen = new Uint8Array(chunk.slice(17, 18))[0];
    const cmd = new Uint8Array(chunk.slice(18 + optLen, 19 + optLen))[0];
    let isUDP = false;
    if (cmd === 1) {} else if (cmd === 2) { isUDP = true; } else { return { hasError: true, message: 'Invalid cmd' }; }
    const portIdx = 19 + optLen;
    const port = new DataView(chunk.slice(portIdx, portIdx + 2)).getUint16(0);
    let addrIdx = portIdx + 2, addrLen = 0, addrValIdx = addrIdx + 1, hostname = '';
    const addressType = new Uint8Array(chunk.slice(addrIdx, addrValIdx))[0];
    switch (addressType) {
        case 1: 
            addrLen = 4; 
            hostname = new Uint8Array(chunk.slice(addrValIdx, addrValIdx + addrLen)).join('.'); 
            break;
        case 2: 
            addrLen = new Uint8Array(chunk.slice(addrValIdx, addrValIdx + 1))[0]; 
            addrValIdx += 1; 
            hostname = new TextDecoder().decode(chunk.slice(addrValIdx, addrValIdx + addrLen)); 
            break;
        case 3: 
            addrLen = 16; 
            const ipv6 = []; 
            const ipv6View = new DataView(chunk.slice(addrValIdx, addrValIdx + addrLen)); 
            for (let i = 0; i < 8; i++) ipv6.push(ipv6View.getUint16(i * 2).toString(16)); 
            hostname = ipv6.join(':'); 
            break;
        default: 
            return { hasError: true, message: `Invalid address type: ${addressType}` };
    }
    if (!hostname) return { hasError: true, message: `Invalid address: ${addressType}` };
    return { hasError: false, addressType, port, hostname, isUDP, rawIndex: addrValIdx + addrLen, version };
}

function makeReadableStream(socket, earlyDataHeader) {
    let cancelled = false;
    return new ReadableStream({
        start(controller) {
            socket.addEventListener('message', (event) => { 
                if (!cancelled) controller.enqueue(event.data); 
            });
            socket.addEventListener('close', () => { 
                if (!cancelled) { 
                    closeSocketQuietly(socket); 
                    controller.close(); 
                } 
            });
            socket.addEventListener('error', (err) => controller.error(err));
            const { earlyData, error } = base64ToArray(earlyDataHeader);
            if (error) controller.error(error); 
            else if (earlyData) controller.enqueue(earlyData);
        },
        cancel() { 
            cancelled = true; 
            closeSocketQuietly(socket); 
        }
    });
}

async function connectStreams(remoteSocket, webSocket, headerData, retryFunc) {
    let header = headerData, hasData = false;
    await remoteSocket.readable.pipeTo(
        new WritableStream({
            async write(chunk, controller) {
                hasData = true;
                if (webSocket.readyState !== WebSocket.OPEN) controller.error('ws.readyState is not open');
                if (header) { 
                    const response = new Uint8Array(header.length + chunk.byteLength);
                    response.set(header, 0);
                    response.set(chunk, header.length);
                    webSocket.send(response.buffer); 
                    header = null; 
                } else { 
                    webSocket.send(chunk); 
                }
            },
            abort() {},
        })
    ).catch((err) => { 
        console.error('Stream pipe error:', err);
        closeSocketQuietly(webSocket); 
    });
    if (!hasData && retryFunc) {
        console.log('No data received, retrying...');
        await retryFunc();
    }
}

async function forwardUDP(udpChunk, webSocket, respHeader) {
    try {
        const tcpSocket = connect({ hostname: '8.8.4.4', port: 53 });
        let vlessHeader = respHeader;
        const writer = tcpSocket.writable.getWriter();
        await writer.write(udpChunk);
        writer.releaseLock();
        await tcpSocket.readable.pipeTo(new WritableStream({
            async write(chunk) {
                if (webSocket.readyState === WebSocket.OPEN) {
                    if (vlessHeader) { 
                        const response = new Uint8Array(vlessHeader.length + chunk.byteLength);
                        response.set(vlessHeader, 0);
                        response.set(chunk, vlessHeader.length);
                        webSocket.send(response.buffer);
                        vlessHeader = null; 
                    } else { 
                        webSocket.send(chunk); 
                    }
                }
            },
        }));
    } catch (error) {
        // console.error('UDP forward error:', error);
    }
}
