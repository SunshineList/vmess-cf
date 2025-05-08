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

    if (params.has('path')) {
        config_additions.path = params.get('path');
    }
    if (config_additions.net === 'grpc' && params.has('serviceName')) {
        config_additions.path = params.get('serviceName'); // gRPC path is serviceName
    }


    if (params.has('host')) {
        config_additions.host = params.get('host');
    } else if (protocol === 'vmess' && params.has('wsHost')) { 
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
    
    if (protocol === 'vmess' && params.has('obfsParam')) {
        try {
            const obfs_param_json_str = params.get('obfsParam');
            let decoded_obfs_param_str = obfs_param_json_str;
            try { decoded_obfs_param_str = decodeURIComponent(obfs_param_json_str); } catch (e) { /* ignore */ }
            const obfs_param_json = JSON.parse(decoded_obfs_param_str);
            if (obfs_param_json.host && !config_additions.host) config_additions.host = obfs_param_json.host;
            if (obfs_param_json.path && !config_additions.path) config_additions.path = obfs_param_json.path;
        } catch (e) {
            console.warn(`警告: VMess obfsParam '${params.get('obfsParam')}' 解析失败: ${e.message}`);
        }
    }
    return config_additions;
}

// 函数：高级解析 VMess/VLESS 链接
function parseInputLink(linkString) {
    let protocol = '';
    if (linkString && linkString.startsWith("vmess://")) protocol = 'vmess';
    else if (linkString && linkString.startsWith("vless://")) protocol = 'vless';
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
    configDict.host = String(configDict.host || (configDict.net === 'ws' || configDict.net === 'http' ? configDict.add : "") || ""); 
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
        finalJson.encryption = configDict.vless_encryption || "none";
        if (finalJson.tls === 'xtls') {
            finalJson.flow = configDict.flow || "xtls-rprx-direct"; 
        }
        if (finalJson.tls === 'reality') {
            finalJson.fp = configDict.fp || "chrome"; 
            finalJson.pbk = configDict.pbk || "";
            finalJson.sid = configDict.sid || "";
        }
        delete finalJson.aid; 
        delete finalJson.scy; 
        if (finalJson.net === 'tcp' && finalJson.type !== 'http') {
            finalJson.type = 'none';
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
    const siteTitle = "Tuple Vmess/Vless链接转换";

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
        <title>${siteTitle}</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
                margin: 0; padding: 20px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                color: #333; display: flex; flex-direction: column; align-items: center; min-height: 100vh; box-sizing: border-box;
            }
            .container {
                background-color: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                width: 100%; max-width: 700px; box-sizing: border-box;
            }
            header { text-align: center; margin-bottom: 30px; }
            header h1 { color: #2c3e50; font-size: 2em; margin-bottom: 5px; }
            header p { color: #7f8c8d; font-size: 0.9em; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 8px; font-weight: 600; color: #34495e; }
            textarea {
                width: calc(100% - 24px); padding: 12px; border: 1px solid #bdc3c7;
                border-radius: 5px; font-size: 1em; box-sizing: border-box; resize: vertical;
                font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; min-height: 100px;
            }
            button, .action-button {
                background-color: #3498db; color: white; padding: 10px 18px; margin-top: 5px;
                border: none; border-radius: 5px; cursor: pointer; font-size: 0.95em;
                transition: background-color 0.3s ease; display: inline-block; text-decoration: none;
                margin-right: 8px; margin-bottom: 8px; text-align: center;
            }
            button:hover, .action-button:hover { background-color: #2980b9; }
            .result-section { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; }
            .result-section h3 { color: #2c3e50; margin-bottom: 10px; }
            .result-box {
                background-color: #f8f9f9; padding: 15px; border-radius: 5px;
                word-wrap: break-word; white-space: pre-wrap;
                font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
                font-size: 0.95em; margin-bottom: 10px; position: relative; border: 1px solid #e0e0e0;
            }
            .result-box.error { background-color: #ffebee; color: #c62828; border: 1px solid #e57373; }
            .copy-btn-inline { 
                background-color: #7f8c8d; color: white; border: none; padding: 5px 8px;
                font-size: 0.8em; border-radius: 3px; cursor: pointer;
                transition: background-color 0.2s ease; margin-left: 10px; 
            }
            .copy-btn-inline:hover { background-color: #566573; }
            .actions-title { font-weight: bold; margin-top:15px; margin-bottom:5px; display:block; }
            .client-actions button, .client-actions a { min-width: 180px; } 
            footer { text-align: center; margin-top: 40px; padding-bottom: 20px; color: #7f8c8d; font-size: 0.85em; }
            @media (max-width: 600px) {
                body { padding: 10px; } .container { padding: 20px; } header h1 { font-size: 1.8em; }
                /* 使按钮在小屏幕上堆叠显示，并占据更大宽度 */
                .client-actions .action-button, .client-actions button { width: calc(100% - 10px); margin-right:0; display: block;}
                 button[type="submit"] { width: 100%; } /* 转换链接按钮也全宽 */
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>${siteTitle}</h1>
                <p>将各类 VMess 或 VLESS 链接转换为包含所有配置的统一 Base64 JSON 格式链接，并尝试一键导入部分客户端。</p>
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

            ${parsedConfigJson ? `
            <div class="result-section">
                <h3>解析后的配置 (中间JSON结构):</h3>
                <div class="result-box">
                    <button class="copy-btn-inline" onclick="enhancedCopyToClipboard(this.nextElementSibling.innerText, this)">复制JSON</button>
                    <pre id="parsedConfigJsonContent">${parsedConfigJson}</pre>
                </div>
            </div>` : ''}

            ${convertedLink ? `
            <div class="result-section">
                <h3>转换后的链接 (Base64 JSON 格式):</h3>
                <div class="result-box">
                     <button class="copy-btn-inline" onclick="enhancedCopyToClipboard('${convertedLink}', this)">复制链接</button>
                    <span id="convertedLinkContent">${convertedLink}</span>
                </div>
                <div class="client-actions">
                    <span class="actions-title">一键操作 (需安装对应客户端):</span><br>
                    <a href="${shadowrocketLink}" class="action-button">导入 Shadowrocket (iOS)</a>
                    <a href="${v2rayngLink}" class="action-button">导入 V2RayNG (Android)</a>
                    <a href="${nekoboxLink}" class="action-button">导入 NekoBox (Android)</a>
                    <button class="action-button" onclick="enhancedCopyToClipboard('${convertedLink}', this)">复制链接 (V2RayN Win/Mac 及桌面)</button>
                    <p style="font-size:0.8em; color:#555;">提示：V2RayN (Windows) 及其他桌面客户端用户请复制链接后，在客户端内从剪贴板导入。Mac 用户请选用兼容的客户端进行导入。</p>
                </div>
            </div>` : ''}
        </div>

        <footer>
            <p>&copy; ${new Date().getFullYear()} ${siteTitle}.</p>
        </footer>

        <script>
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
