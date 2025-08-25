// 辅助函数：将 UTF-8 字符串编码为 Base64 (标准格式)
function encodeBase64(utf8String) {
    try {
        return btoa(unescape(encodeURIComponent(utf8String)));
    } catch (e) {
        console.error("编码为 Base64 失败:", utf8String, e);
        throw new Error("Base64 编码失败: " + e.message);
    }
}

// 辅助函数：解码 Base64 字符串并转为 UTF-8 字符串
function decodeBase64(base64String) {
    let base64 = base64String.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) {
        base64 += '='.repeat(4 - padding);
    }
    try {
        const latin1DecodedString = atob(base64);
        return decodeURIComponent(escape(latin1DecodedString));
    } catch (e) {
        console.error("解码 Base64 字符串失败:", base64String, e);
        try {
            return atob(base64); 
        } catch (e2) {
             throw new Error("Base64 解码失败 (包括备选方案): " + e.message + " / " + e2.message);
        }
    }
}

// 函数：解析 URI 中的查询参数
function parseURIQueryParams(query_string, protocol) {
    const params = new URLSearchParams(query_string);
    const config_additions = {};

    if (params.has('remarks')) {
        config_additions.ps = params.get('remarks');
    } else if (params.has('ps')) {
        config_additions.ps = params.get('ps');
    }

    const netParamKey = protocol === 'vmess' ? 'obfs' : 'type';
    const netParam = params.get(netParamKey);
    if (netParam) {
        const netType = netParam.toLowerCase();
        if (netType === 'websocket') config_additions.net = 'ws';
        else if (netType === 'grpc') config_additions.net = 'grpc';
        else config_additions.net = netType;
    }

    // 兼容 vless 中使用 obfs=websocket 的写法
    if (protocol === 'vless' && params.has('obfs') && !config_additions.net) {
        const obfsType = (params.get('obfs') || '').toLowerCase();
        if (obfsType === 'websocket') {
            config_additions.net = 'ws';
        } else if (obfsType === 'grpc') {
            config_additions.net = 'grpc';
        }
    }

    if (params.has('path')) {
        config_additions.path = params.get('path');
    }
    if (config_additions.net === 'grpc' && params.has('serviceName')) {
        config_additions.path = params.get('serviceName'); // gRPC path is serviceName
    }


    if (params.has('host')) {
        config_additions.host = params.get('host');
    } else if ((protocol === 'vmess' || protocol === 'vless') && params.has('wsHost')) { 
        config_additions.host = params.get('wsHost');
    }

    const securityParam = params.get('security');
    if (params.has('pbk')) { 
        config_additions.tls_security = 'reality'; 
        config_additions.pbk = params.get('pbk');
        if (params.has('fp')) config_additions.fp = params.get('fp'); 
        if (params.has('sid')) config_additions.sid = params.get('sid'); 
        if (params.has('sni')) config_additions.sni = params.get('sni');
        else if (params.has('peer')) config_additions.sni = params.get('peer');
        if (params.has('spx')) config_additions.spx = params.get('spx');
        if (params.has('flow')) config_additions.flow = params.get('flow');
        // Shadowrocket 等客户端用 xtls=1/2 表示 flow
        if (params.has('xtls')) {
            const xtlsVal = (params.get('xtls') || '').toString().trim();
            if (!config_additions.flow) {
                config_additions.flow = xtlsVal === '2' ? 'xtls-rprx-vision' : 'xtls-rprx-direct';
            }
        }

    } else if (securityParam === 'xtls' || (params.has('flow') && params.get('flow').toLowerCase().includes('xtls'))) {
        config_additions.tls_security = 'xtls';
        if (params.has('flow')) config_additions.flow = params.get('flow');
        if (params.has('sni')) config_additions.sni = params.get('sni');
        else if (params.has('peer')) config_additions.sni = params.get('peer');
        if (params.has('fp')) config_additions.fp = params.get('fp');

    } else if (params.get('tls') === '1' || params.get('tls') === 'true' || securityParam === 'tls') {
        config_additions.tls_security = 'tls';
        if (params.has('sni')) config_additions.sni = params.get('sni');
        else if (params.has('peer')) config_additions.sni = params.get('peer');
        if (params.has('fp')) config_additions.fp = params.get('fp');
    }
    
    if (params.has('xtls') && !config_additions.tls_security) { 
        config_additions.custom_xtls_value = params.get('xtls'); 
        if (params.get('xtls')) { 
            config_additions.tls_security = 'xtls'; 
             if (params.has('sni')) config_additions.sni = params.get('sni');
             else if (params.has('peer')) config_additions.sni = params.get('peer');
        }
    }

    if (protocol === 'vmess') {
        if (params.has('alterId')) config_additions.aid = params.get('alterId');
        else if (params.has('aid')) config_additions.aid = params.get('aid');
        
        const vmessScyParam = params.get('scy') || params.get('security');
        if (vmessScyParam && !['tls', 'xtls', 'reality'].includes(vmessScyParam.toLowerCase())) {
            config_additions.scy = vmessScyParam;
        }
    }

    if (protocol === 'vless') {
        if (params.has('encryption') && params.get('encryption').toLowerCase() !== 'none') {
            config_additions.vless_encryption = params.get('encryption'); 
        }
        if (params.has('flow') && !config_additions.flow ) { 
             config_additions.flow = params.get('flow');
        }
        if (config_additions.net === 'grpc') {
            if (params.has('mode')) config_additions.grpc_mode = params.get('mode'); 
        }
    }
    if (protocol === 'hysteria2' || protocol === 'hy2') {
        if (params.has('peer')) config_additions.peer = params.get('peer');
        if (params.has('sni')) config_additions.sni = params.get('sni');
        // 兼容一些实现里的 alpn、obfs、obfs-password 等（先占位透传，后续可扩展）
        if (params.has('alpn')) config_additions.alpn = params.get('alpn');
        if (params.has('obfs')) config_additions.hy2_obfs = params.get('obfs');
        if (params.has('obfs-password')) config_additions.hy2_obfs_password = params.get('obfs-password');
    }
    
    if (protocol === 'vmess' && params.has('obfsParam')) {
        const obfs_param_raw = params.get('obfsParam');
        let decoded_obfs_param = obfs_param_raw;
        try { decoded_obfs_param = decodeURIComponent(obfs_param_raw); } catch (e) { /* ignore */ }
        try {
            const obfs_param_json = JSON.parse(decoded_obfs_param);
            if (obfs_param_json && typeof obfs_param_json === 'object') {
                // 键名小写归一化，兼容 Host/Path 等大小写
                const lowered = {};
                Object.keys(obfs_param_json).forEach(k => {
                    lowered[k.toLowerCase()] = obfs_param_json[k];
                });
                if (lowered.host && !config_additions.host) config_additions.host = lowered.host;
                if (lowered.path && !config_additions.path) config_additions.path = lowered.path;
            }
        } catch (e) {
            // 非 JSON，视作纯主机名
            if (!config_additions.host && decoded_obfs_param && !decoded_obfs_param.includes('{') && !decoded_obfs_param.includes('}')) {
                config_additions.host = decoded_obfs_param;
            }
        }
    }
    if (protocol === 'vless' && params.has('obfsParam')) {
        const obfs_param_raw = params.get('obfsParam');
        let decoded_obfs_param = obfs_param_raw;
        try { decoded_obfs_param = decodeURIComponent(obfs_param_raw); } catch (e) { /* ignore */ }
        // 尝试 JSON；失败则当成纯主机名
        try {
            const obj = JSON.parse(decoded_obfs_param);
            if (obj && typeof obj === 'object') {
                if (obj.host && !config_additions.host) config_additions.host = obj.host;
                if (obj.path && !config_additions.path) config_additions.path = obj.path;
            }
        } catch (e) {
            if (!config_additions.host && decoded_obfs_param && !decoded_obfs_param.includes('{') && !decoded_obfs_param.includes('}')) {
                config_additions.host = decoded_obfs_param;
            }
        }
    }
    return config_additions;
}

// 函数：高级解析 VMess/VLESS 链接
function parseInputLink(linkString) {
    let protocol = '';
    if (linkString && linkString.startsWith("vmess://")) protocol = 'vmess';
    else if (linkString && linkString.startsWith("vless://")) protocol = 'vless';
    else if (linkString && (linkString.startsWith("hysteria2://") || linkString.startsWith("hy2://"))) protocol = 'hysteria2';
    else return { error: "链接无效：必须以 vmess:// 或 vless:// 开头" };

    let mainPartEncodedOrPlain = linkString.substring(protocol.length + 3); 
    let queryString = "";

    const queryStartIndex = mainPartEncodedOrPlain.indexOf('?');
    if (queryStartIndex !== -1) {
        queryString = mainPartEncodedOrPlain.substring(queryStartIndex + 1);
        mainPartEncodedOrPlain = mainPartEncodedOrPlain.substring(0, queryStartIndex);
    }
    
    let configDict = { _protocol: protocol }; 

    try {
        let decodedMainPartStr = '';
        if ((protocol === 'vless' && mainPartEncodedOrPlain.includes('@') && mainPartEncodedOrPlain.includes(':') && !mainPartEncodedOrPlain.match(/[^a-zA-Z0-9+\/@:=_.-]/)) ||
            (protocol === 'vmess' && mainPartEncodedOrPlain.includes('@') && mainPartEncodedOrPlain.includes(':') && !mainPartEncodedOrPlain.match(/[^a-zA-Z0-9+\/@:=_.-]/) && !mainPartEncodedOrPlain.startsWith('{'))) {
            try {
                decodedMainPartStr = decodeURIComponent(mainPartEncodedOrPlain);
            } catch (uriError) { 
                 console.warn("URI解码主要部分失败，尝试直接使用:", uriError);
                 decodedMainPartStr = mainPartEncodedOrPlain;
            }
        } else { 
            try {
                decodedMainPartStr = decodeBase64(mainPartEncodedOrPlain);
            } catch (b64Error) { 
                 console.warn("Base64解码主要部分失败，尝试URI解码:", b64Error);
                try {
                    decodedMainPartStr = decodeURIComponent(mainPartEncodedOrPlain);
                } catch (uriErrorFinal) {
                    return { error: `无法解码链接主要部分: ${b64Error.message} / ${uriErrorFinal.message}` };
                }
            }
        }

        if (protocol === 'vless') {
            const atSignIndex = decodedMainPartStr.lastIndexOf('@');
            if (atSignIndex === -1) return { error: `VLESS链接主要部分格式错误: 缺少 '@'` };
            
            let userInfoPart = decodedMainPartStr.substring(0, atSignIndex); 
            const addrPart = decodedMainPartStr.substring(atSignIndex + 1);
            const portColonIndex = addrPart.lastIndexOf(':');
            if (portColonIndex === -1) return { error: `VLESS链接地址部分格式错误: 缺少端口` };

            configDict.add = addrPart.substring(0, portColonIndex);
            const portStr = addrPart.substring(portColonIndex + 1);
            const portNum = parseInt(portStr, 10);
            if (isNaN(portNum)) return { error: `端口 '${portStr}' 不是有效数字。` };
            configDict.port = portNum;
            configDict.vless_encryption = "none"; 

            if (userInfoPart.includes(':') && userInfoPart.length > 37) { 
                const idParts = userInfoPart.split(':', 2); 
                configDict.vless_id_prefix = idParts[0]; 
                configDict.id = idParts[1] || idParts[0]; 
            } else {
                configDict.id = userInfoPart; 
            }

        } else if (protocol === 'vmess') {
            try {
                configDict = { ...configDict, ...JSON.parse(decodedMainPartStr) };
            } catch (e) {
                const parts = decodedMainPartStr.split('@');
                if (parts.length === 2) {
                    const userInfo = parts[0]; 
                    const addrPort = parts[1]; 
                    const userInfoParts = userInfo.split(':', 2); 
                    if (userInfoParts.length === 1) { 
                        configDict.id = userInfoParts[0];
                        configDict.scy = configDict.scy || 'auto'; 
                    } else { 
                        configDict.scy = userInfoParts[0];
                        configDict.id = userInfoParts[1]; 
                    }
                    if(!configDict.id) return { error: "VMess 用户信息解析失败: 缺少ID" };

                    const portSeparatorIndex = addrPort.lastIndexOf(':');
                    if (portSeparatorIndex !== -1) {
                        configDict.add = addrPort.substring(0, portSeparatorIndex); 
                        const portStr = addrPort.substring(portSeparatorIndex + 1); 
                        const portNum = parseInt(portStr, 10); 
                        if (isNaN(portNum)) return { error: `端口 '${portStr}' 不是有效数字。` };
                        configDict.port = portNum; 
                    } else { return { error: "VMess 地址和端口格式不正确。" }; }
                } else {
                    return { error: "VMess 解码后内容格式未知。" };
                }
            }
        } else if (protocol === 'hysteria2') {
            // hy2/hysteria2: 直接 URI 解码并按 userinfo@host:port 解析
            let decoded = '';
            try {
                decoded = decodeURIComponent(mainPartEncodedOrPlain);
            } catch (e) {
                decoded = mainPartEncodedOrPlain;
            }
            const atIdx = decoded.lastIndexOf('@');
            if (atIdx === -1) return { error: `Hysteria2 链接格式错误: 缺少 '@'` };
            const userInfo = decoded.substring(0, atIdx);
            const addrPort = decoded.substring(atIdx + 1);

            // IPv6 支持
            let host = '';
            let portStr = '';
            if (addrPort.startsWith('[')) {
                const endBracket = addrPort.indexOf(']');
                if (endBracket === -1) return { error: `Hysteria2 IPv6 地址缺少 ']'` };
                host = addrPort.substring(0, endBracket + 1); // 包含方括号
                if (addrPort.length <= endBracket + 2 || addrPort[endBracket + 1] !== ':') {
                    return { error: `Hysteria2 地址部分缺少端口` };
                }
                portStr = addrPort.substring(endBracket + 2);
            } else {
                const colonIdx = addrPort.lastIndexOf(':');
                if (colonIdx === -1) return { error: `Hysteria2 地址部分缺少端口` };
                host = addrPort.substring(0, colonIdx);
                portStr = addrPort.substring(colonIdx + 1);
            }
            const portNum = parseInt(portStr, 10);
            if (isNaN(portNum)) return { error: `端口 '${portStr}' 不是有效数字。` };

            configDict.add = host.startsWith('[') ? host.slice(1, -1) : host;
            configDict.port = portNum;
            configDict.hy2_auth = userInfo; // 认证字段
        }
    } catch (e) {
        return { error: `解码或解析链接主要部分时出错: ${e.message}` };
    }

    if (queryString) {
        const queryAdditions = parseURIQueryParams(queryString, protocol);
        Object.assign(configDict, queryAdditions); 
    }
    
    configDict.v = String(configDict.v || "2"); 
    configDict.ps = String(configDict.ps || `Parsed ${protocol.toUpperCase()} Node`);
    configDict.add = String(configDict.add || "");
    configDict.port = String(configDict.port || "0"); 
    configDict.id = String(configDict.id || ""); 
    configDict.net = String(configDict.net || "tcp"); 
    configDict.type = String(configDict.type || "none"); 
    // 不要将 WS/HTTP 的 host 回退为 add，避免错误将地址当作 Host 头
    configDict.host = String(configDict.host || ""); 
    configDict.path = String(configDict.path || (configDict.net === 'grpc' ? "" : (configDict.net === 'ws' ? "/" : "")));

    if (protocol === 'vmess') {
        configDict.aid = String(configDict.aid || "0"); 
        configDict.scy = String(configDict.scy || "auto"); 
    } else if (protocol === 'vless') {
        configDict.vless_encryption = String(configDict.vless_encryption || "none");
        configDict.tls = String(configDict.tls_security || ""); 
        if (configDict.tls === 'reality') {
            configDict.fp = String(configDict.fp || "chrome"); 
            configDict.pbk = String(configDict.pbk || "");
            configDict.sid = String(configDict.sid || "");
        }
        if (configDict.tls === 'xtls') {
            configDict.flow = String(configDict.flow || (configDict.custom_xtls_value ? `xtls-rprx-${configDict.custom_xtls_value}`: "xtls-rprx-direct"));
        }
        delete configDict.aid;
        delete configDict.scy;
    } else if (protocol === 'hysteria2') {
        // hy2: 设置合理默认
        configDict.hy2_auth = String(configDict.hy2_auth || "");
        configDict.peer = String(configDict.peer || "");
        delete configDict.tls_security;
        delete configDict.custom_xtls_value;
    }
    
    configDict.sni = String(configDict.sni || (configDict.tls ? configDict.host : "") || ""); 
    if (!configDict.tls) delete configDict.sni;

    delete configDict.tls_security; 
    delete configDict.custom_xtls_value;

    return { config: configDict }; 
}

// 函数：根据配置字典生成输出链接
function generateOutputLink(configDict) {
    const protocol = configDict._protocol || 'vmess'; 
    let finalJson = {
        v: configDict.v || "2",
        ps: configDict.ps,
        add: configDict.add,
        port: parseInt(configDict.port, 10),
        id: configDict.id, 
        net: configDict.net,
        type: configDict.type, 
        host: configDict.host,
        path: configDict.path,
        tls: configDict.tls || "", 
        sni: configDict.sni,
    };

    if (protocol === 'vmess') {
        finalJson.aid = parseInt(configDict.aid, 10);
        finalJson.scy = configDict.scy;
    } else if (protocol === 'vless') {
        // 直接生成标准 vless URI，而不是 Base64 JSON
        try {
            const userId = String(configDict.id || '').trim();
            const address = String(configDict.add || '').trim();
            const portStr = String(configDict.port || '').trim();
            if (!userId || !address || !portStr) {
                return { error: '生成 VLESS 链接时缺少必要字段: id/add/port' };
            }

            const qp = new URLSearchParams();

            // type 映射
            const net = (configDict.net || '').toLowerCase();
            if (net) qp.set('type', net);

            // security 与附加参数
            const security = (configDict.tls || '').toLowerCase();
            if (security) {
                qp.set('security', security);
                if (configDict.sni) qp.set('sni', configDict.sni);
                if (security === 'reality') {
                    if (configDict.fp) qp.set('fp', configDict.fp);
                    if (configDict.pbk) qp.set('pbk', configDict.pbk);
                    if (configDict.sid) qp.set('sid', configDict.sid);
                    if (configDict.spx) qp.set('spx', configDict.spx);
                }
                // xtls 或包含 flow 的情况
                if (configDict.flow) {
                    qp.set('flow', configDict.flow);
                } else if (security === 'reality') {
                    // Reality 若未指定 flow，采用常见默认
                    qp.set('flow', 'xtls-rprx-vision');
                }
            }

            // 传输层参数
            if (net === 'ws') {
                if (configDict.host) qp.set('host', configDict.host);
                if (configDict.path) qp.set('path', configDict.path);
            } else if (net === 'grpc') {
                if (configDict.path) qp.set('serviceName', configDict.path);
                if (configDict.grpc_mode) qp.set('mode', configDict.grpc_mode);
            }

            // vless encryption（非 none 再加）
            const vlessEnc = (configDict.vless_encryption || '').toLowerCase();
            if (vlessEnc && vlessEnc !== 'none') {
                qp.set('encryption', configDict.vless_encryption);
            }

            const remarks = String(configDict.ps || '').trim();
            const hash = remarks ? `#${encodeURIComponent(remarks)}` : '';
            const link = `vless://${encodeURIComponent(userId)}@${address}:${portStr}?${qp.toString()}${hash}`;
            return { link, protocol: 'vless' };
        } catch (e) {
            return { error: `生成 VLESS 链接时出错: ${e.message}` };
        }
    } else if (protocol === 'hysteria2') {
        // 生成 hy2 URI：hysteria2://auth@[host or [IPv6]]:port?peer=...#ps
        try {
            const auth = String(configDict.hy2_auth || '').trim();
            const address = String(configDict.add || '').trim();
            const portStr = String(configDict.port || '').trim();
            if (!auth || !address || !portStr) {
                return { error: '生成 Hysteria2 链接时缺少必要字段: auth/add/port' };
            }
            const qp = new URLSearchParams();
            if (configDict.peer) qp.set('peer', configDict.peer);
            if (configDict.sni) qp.set('sni', configDict.sni);
            if (configDict.alpn) qp.set('alpn', configDict.alpn);
            if (configDict.hy2_obfs) qp.set('obfs', configDict.hy2_obfs);
            if (configDict.hy2_obfs_password) qp.set('obfs-password', configDict.hy2_obfs_password);

            const hostOut = address.includes(':') && !address.startsWith('[') ? `[${address}]` : address;
            const hash = '';
            const scheme = 'hysteria2';
            const link = `${scheme}://${encodeURIComponent(auth)}@${hostOut}:${portStr}?${qp.toString()}${hash}`;
            return { link, protocol: 'hysteria2' };
        } catch (e) {
            return { error: `生成 Hysteria2 链接时出错: ${e.message}` };
        }
    }

    if (!finalJson.host) delete finalJson.host;
    if ((!finalJson.path || finalJson.path === "/") && !['ws', 'grpc', 'http'].includes(finalJson.net)) {
        delete finalJson.path;
    }
     if (finalJson.path === "" && finalJson.net !== "grpc") { 
        delete finalJson.path;
    }
    if (!finalJson.tls) { 
        delete finalJson.tls;
        delete finalJson.sni;
        if (protocol === 'vless') {
            delete finalJson.fp;
            delete finalJson.pbk;
            delete finalJson.sid;
            delete finalJson.flow; 
        }
    }
    if (!finalJson.sni && finalJson.tls) {
        finalJson.sni = finalJson.host || ""; 
    }
    if (!finalJson.sni) delete finalJson.sni; 

    if (finalJson.type === "none") { 
         delete finalJson.type;
    }

    try {
        const tempConfig = {...finalJson}; 
        Object.keys(tempConfig).forEach(key => { 
            if (tempConfig[key] === undefined || tempConfig[key] === null || tempConfig[key] === "") { // 更严格地移除空字符串字段，除了ps
                if (key !== "ps") { // ps 备注允许为空
                    delete tempConfig[key];
                }
            }
        });
        const sortedConfig = {};
        Object.keys(tempConfig).sort().forEach(key => {
            sortedConfig[key] = tempConfig[key];
        });

        const configStr = JSON.stringify(sortedConfig);
        const base64EncodedConfig = encodeBase64(configStr).replace(/=+$/, ''); 
        return { link: `${protocol}://${base64EncodedConfig}`, protocol: protocol }; 
    } catch (e) {
        return { error: `生成 ${protocol.toUpperCase()} 链接时出错: ${e.message}` };
    }
}

// HTML 生成函数
function getHtml(data = {}) {
    const { originalLink = '', parsedConfigJson = '', convertedLink = '', outputProtocol = 'vmess', error = '' } = data;
    const siteTitle = "Shadowrocket Vmess/Vless 一键转换标准链接";

    let shadowrocketLink = '';
    let v2rayngLink = '';
    let nekoboxLink = ''; 

    if (convertedLink) {
        const encodedConvertedLink = encodeURIComponent(convertedLink);
        shadowrocketLink = `shadowrocket://add/${encodedConvertedLink}`;
        v2rayngLink = `v2rayng://install-config?url=${encodedConvertedLink}`;
        nekoboxLink = `nekobox://import?url=${encodedConvertedLink}`; 
    }

    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="theme-color" content="#2c3e50">
        <title>${siteTitle}</title>
        <style>
            :root {
                --bg: #f5f7fa;
                --bg2: #ffffff;
                --fg: #2c3e50;
                --fg2: #34495e;
                --muted: #7f8c8d;
                --border: #e0e0e0;
                --primary: #3498db;
                --primary-700: #2980b9;
                --danger-bg: #ffebee;
                --danger-fg: #c62828;
                --danger-border: #e57373;
                --shadow: 0 10px 25px rgba(0,0,0,.08);
                --radius: 12px;
            }
            @media (prefers-color-scheme: dark) {
                :root {
                    --bg: #0f141a;
                    --bg2: #111827;
                    --fg: #e5e7eb;
                    --fg2: #d1d5db;
                    --muted: #9ca3af;
                    --border: #253041;
                    --primary: #60a5fa;
                    --primary-700: #3b82f6;
                    --danger-bg: rgba(239,68,68,.15);
                    --danger-fg: #ef4444;
                    --danger-border: rgba(239,68,68,.35);
                    --shadow: 0 10px 25px rgba(0,0,0,.35);
                }
            }
            * { box-sizing: border-box; }
            html { -webkit-text-size-adjust: 100%; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
                margin: 0; padding: 20px; padding-left: max(20px, env(safe-area-inset-left)); padding-right: max(20px, env(safe-area-inset-right));
                background:
                    radial-gradient(1200px 800px at 10% 10%, rgba(56,189,248,0.14), transparent 60%),
                    radial-gradient(1200px 800px at 90% 30%, rgba(167,139,250,0.16), transparent 60%),
                    linear-gradient(135deg, var(--bg) 0%, #c3cfe2 100%);
                color: var(--fg); display: flex; flex-direction: column; align-items: center; min-height: 100vh;
            }
            #bg-canvas {
                position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: -1; pointer-events: none;
            }
            .container {
                background-color: var(--bg2); padding: 24px; border-radius: 18px; box-shadow: 0 20px 50px rgba(0,0,0,.08);
                width: 100%; max-width: 840px; margin: 0 auto;
            }
            header { text-align: center; margin-bottom: 22px; }
            header h1 { color: var(--fg); font-size: clamp(1.45rem, 3.8vw, 2.1rem); margin: 0 0 2px; letter-spacing: .25px; font-weight: 800; }
            header .subtitle { color: var(--muted); font-size: clamp(.88rem, 2.4vw, .95rem); margin: 0; }
            header .title-accent { display: inline-block; margin-top: 8px; height: 3px; width: 120px; background: linear-gradient(90deg,#60a5fa,#34d399,#f59e0b); border-radius: 999px; }
            .form-group { margin-bottom: 16px; }
            label { display: block; margin-bottom: 8px; font-weight: 600; color: var(--fg2); }
            textarea {
                width: 100%; padding: 14px 12px; border: 1px solid var(--border);
                border-radius: 10px; font-size: 0.95rem; resize: vertical; min-height: 120px; background: transparent; color: var(--fg);
                font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
            }
            textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(52,152,219,.15); }
            button, .action-button, .copy-btn-inline {
                background-color: var(--primary); color: #fff; padding: 12px 18px; margin-top: 6px;
                border: none; border-radius: 8px; cursor: pointer; font-size: 0.95rem; line-height: 1;
                transition: background-color .2s ease, transform .05s ease; display: inline-block; text-decoration: none;
                margin-right: 8px; margin-bottom: 10px; text-align: center;
            }
            button:hover, .action-button:hover, .copy-btn-inline:hover { background-color: var(--primary-700); }
            button:active, .action-button:active, .copy-btn-inline:active { transform: translateY(1px); }
            button:focus-visible, .action-button:focus-visible, .copy-btn-inline:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
            .copy-btn-inline { background-color: #7f8c8d; padding: 6px 10px; font-size: .85rem; }
            .copy-btn-inline:hover { background-color: #566573; }
            .result-section { margin-top: 26px; padding-top: 18px; border-top: 1px solid var(--border); }
            .result-section h3 { color: var(--fg); margin: 0 0 12px; font-size: 1.1rem; }
            .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 8px 0 14px; }
            .toolbar .primary { background: linear-gradient(135deg, #60a5fa, #3b82f6); }
            .toolbar .secondary { background: linear-gradient(135deg, #34d399, #22c55e); }
            .toolbar .neutral { background: linear-gradient(135deg, #a78bfa, #6366f1); }
            .result-box {
                background-color: rgba(0,0,0,.02); padding: 14px; border-radius: 12px;
                word-wrap: break-word; white-space: pre-wrap; border: 1px solid var(--border);
                font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; color: var(--fg);
                font-size: 0.92rem; margin-bottom: 12px; position: relative; overflow: auto;
                -webkit-overflow-scrolling: touch; max-height: 40vh;
            }
            .result-box.error { background-color: var(--danger-bg); color: var(--danger-fg); border: 1px solid var(--danger-border); }
            .actions-title { font-weight: 700; margin:14px 0 8px; display:block; color: var(--fg2); }
            .notice { background: rgba(99,102,241,.06); border: 1px dashed rgba(99,102,241,.35); color: var(--fg); padding: 12px 14px; border-radius: 12px; font-size: .92rem; }
            .notice h4 { margin: 0 0 8px; font-size: 1rem; color: var(--fg2); }
            .notice ul { margin: 0; padding-left: 18px; }
            .notice li { margin: 6px 0; }
            .client-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
            .client-actions button, .client-actions a { min-width: 0; width: 100%; margin: 0; }
            footer { text-align: center; margin-top: 36px; padding-bottom: 16px; color: var(--muted); font-size: 0.85rem; }
            footer a { color: var(--primary-700); text-decoration: none; }
            footer a:hover { text-decoration: underline; }
            .disclaimer { margin-top: 6px; font-size: 0.82rem; color: var(--muted); }
            @media (max-width: 820px) { .container { max-width: 100%; padding: 18px; } }
            @media (max-width: 600px) {
                body { padding: 12px; padding-left: max(12px, env(safe-area-inset-left)); padding-right: max(12px, env(safe-area-inset-right)); }
                header h1 { font-size: clamp(1.25rem, 6vw, 1.6rem); }
                .toolbar { gap: 8px; }
                .client-actions { grid-template-columns: 1fr; }
                .client-actions .action-button, .client-actions button { width: 100%; margin-right:0; display: block;}
                button[type="submit"] { width: 100%; }
            }
            @media (max-width: 400px) {
                header p { font-size: .9rem; }
                textarea { font-size: .9rem; min-height: 130px; }
            }
        </style>
    </head>
    <body>
        <canvas id="bg-canvas"></canvas>
        <div class="container">
            <header>
                <h1>${siteTitle}</h1>
                <p class="subtitle">统一解析/转换 VMess、VLESS、Hy2 等链接，便捷复制与一键导入</p>
                <span class="title-accent"></span>
            </header>

            <form method="POST" action="/">
                <div class="form-group">
                    <label for="inputLink">输入VMess/VLESS链接:</label>
                    <textarea id="inputLink" name="inputLink" rows="5" required placeholder="vmess://... 或 vless://...">${originalLink}</textarea>
                </div>
                <button type="submit">转换链接</button>
            </form>

            ${error ? `
            <div class="result-section">
                <h3>转换出错</h3>
                <div class="result-box error">${error.replace(/\n/g, '<br>')}</div>
            </div>` : ''}

            <div class="result-section">
                <h3>注意事项</h3>
                <div class="notice">
                    <h4>使用前请了解：</h4>
                    <ul>
                        <li>本工具仅在浏览器内本地处理，不上传你的节点数据。</li>
                        <li>不同客户端字段可能存在差异（如 wsHost/host、xtls/flow 等），已尽量兼容。</li>
                        <li>若导入失败，请先复制到剪贴板再在客户端内手动从剪贴板导入。</li>
                        <li>移动端如无法自动复制，系统设置或浏览器权限可能限制剪贴板访问。</li>
                    </ul>
                </div>
            </div>

            ${parsedConfigJson ? `
            <div class="result-section">
                <h3>解析后的配置 (中间 JSON)</h3>
                <div class="toolbar">
                    <button class="action-button neutral" onclick="enhancedCopyToClipboard(document.getElementById('parsedConfigJsonContent').innerText, this)">复制 JSON</button>
                </div>
                <div class="result-box">
                    <pre id="parsedConfigJsonContent" style="margin:0; white-space: pre-wrap; word-break: break-word;">${parsedConfigJson}</pre>
                </div>
            </div>` : ''}

            ${convertedLink ? `
            <div class="result-section">
                <h3>转换后的链接</h3>
                <div class="toolbar">
                    <button class="action-button neutral" onclick="enhancedCopyToClipboard('${convertedLink}', this)">复制链接</button>
                    <a href="${shadowrocketLink}" class="action-button primary">导入 Shadowrocket</a>
                    <a href="${v2rayngLink}" class="action-button secondary">导入 V2RayNG</a>
                    <a href="${nekoboxLink}" class="action-button primary">导入 NekoBox</a>
                </div>
                <div class="result-box">
                    <pre style="margin:0; white-space: pre-wrap; word-break: break-all;">${convertedLink}</pre>
                </div>
                <p style="font-size:0.85em; color:#555; margin: 6px 0 0;">提示：桌面端（如 V2RayN）请复制链接后，在客户端内从剪贴板导入。</p>
            </div>` : ''}
        </div>

        <footer>
            <p>&copy; ${new Date().getFullYear()} ${siteTitle}</p>
            <p>作者：Tuple（ 一名发烧 coder ） · <a href="https://github.com/SunshineList/vmess-cf" target="_blank" rel="noopener">GitHub 项目导航</a></p>
            <p class="disclaimer">无责声明：本工具仅用于格式解析与学习研究，不提供任何网络服务或节点资源；由此产生的使用风险与后果由用户自行承担。</p>
        </footer>

        <script>
            // 粒子背景（轻量）
            (function(){
                const canvas = document.getElementById('bg-canvas');
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
                let width, height, particles;
                function resize(){
                    width = canvas.clientWidth; height = canvas.clientHeight;
                    canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
                    ctx.setTransform(dpr,0,0,dpr,0,0);
                    init();
                }
                function rand(min,max){ return Math.random()*(max-min)+min; }
                function init(){
                    const count = Math.floor(Math.min(90, Math.max(40, (width*height)/24000)));
                    particles = Array.from({length: count}).map(()=>({
                        x: rand(0,width), y: rand(0,height), r: rand(0.6,1.8),
                        vx: rand(-0.3,0.3), vy: rand(-0.3,0.3), a: rand(0.2,0.6)
                    }));
                }
                function step(){
                    ctx.clearRect(0,0,width,height);
                    // 连接线
                    for (let i=0;i<particles.length;i++){
                        const p = particles[i];
                        p.x += p.vx; p.y += p.vy;
                        if (p.x<0||p.x>width) p.vx*=-1; if (p.y<0||p.y>height) p.vy*=-1;
                    }
                    for (let i=0;i<particles.length;i++){
                        for (let j=i+1;j<particles.length;j++){
                            const a = particles[i], b = particles[j];
                            const dx=a.x-b.x, dy=a.y-b.y; const dist = Math.hypot(dx,dy);
                            if (dist<120){
                                const o = (1 - dist/120) * 0.25;
                                ctx.strokeStyle = 'rgba(99,102,241,' + o + ')';
                                ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
                            }
                        }
                    }
                    // 粒子
                    for (const p of particles){
                        ctx.fillStyle = 'rgba(56,189,248,' + p.a + ')';
                        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
                    }
                    requestAnimationFrame(step);
                }
                window.addEventListener('resize', resize, {passive:true});
                resize();
                requestAnimationFrame(step);
            })();

            function enhancedCopyToClipboard(textToCopy, buttonElement) {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        const originalText = buttonElement.innerText;
                        buttonElement.innerText = '已复制!';
                        buttonElement.disabled = true;
                        setTimeout(() => {
                            buttonElement.innerText = originalText;
                            buttonElement.disabled = false;
                        }, 2000);
                    }).catch(err => {
                        console.warn('navigator.clipboard.writeText 失败:', err);
                        fallbackCopyToClipboard(textToCopy, buttonElement);
                    });
                } else {
                    console.warn('navigator.clipboard 不可用，尝试备选方案。');
                    fallbackCopyToClipboard(textToCopy, buttonElement);
                }
            }

            function fallbackCopyToClipboard(text, buttonElement) {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed"; 
                textArea.style.top = "-9999px"; // 移出屏幕外
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                let success = false;
                try {
                    success = document.execCommand('copy');
                    const originalText = buttonElement.innerText;
                    buttonElement.innerText = success ? '已复制 (备选)!' : '复制失败!';
                    buttonElement.disabled = true;
                     setTimeout(() => {
                        buttonElement.innerText = originalText;
                        buttonElement.disabled = false;
                    }, 2000);
                } catch (err) {
                    console.error('备选复制方案 document.execCommand 失败:', err);
                    buttonElement.innerText = '复制失败!';
                     setTimeout(() => {
                        buttonElement.innerText = buttonElement.dataset.originalText || '复制';
                    }, 2000);
                }
                document.body.removeChild(textArea);
            }
        </script>
    </body>
    </html>
    `;
}

// Cloudflare Worker 的入口点
export default {
    async fetch(request) {
        let originalLink = ''; 
        let dataToRender = {}; 

        if (request.method === "POST") { 
            try {
                const formData = await request.formData(); 
                originalLink = formData.get("inputLink") || "";
            } catch (e) {
                const textBody = await request.text();
                const params = new URLSearchParams(textBody);
                originalLink = params.get("inputLink") || "";
            }
        } else if (request.method === "GET") { 
            const url = new URL(request.url);
            originalLink = url.searchParams.get("link") || ""; 
        }

        if (originalLink) {
            dataToRender.originalLink = originalLink; 
            const parsedResult = parseInputLink(originalLink); 

            if (parsedResult.error) { 
                dataToRender.error = parsedResult.error;
            } else { 
                dataToRender.parsedConfigJson = JSON.stringify(parsedResult.config, null, 2); 
                const generationResult = generateOutputLink(parsedResult.config); 

                if (generationResult.error) { 
                    dataToRender.error = (dataToRender.error ? dataToRender.error + '\n' : '') + generationResult.error;
                } else { 
                    dataToRender.convertedLink = generationResult.link; 
                    dataToRender.outputProtocol = generationResult.protocol;
                }
            }
        }
        
        return new Response(getHtml(dataToRender), {
            headers: { 
                "Content-Type": "text/html; charset=utf-8",
            },
        });
    },
};
