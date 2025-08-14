const axios = require("axios");

function number(cli) {
    try {
        if (cli.startsWith('+880')) return cli.slice(4);
        if (cli.startsWith('880')) return cli.slice(3);
        if (cli.startsWith('0')) return cli.slice(1);
        return cli;
    } catch (error) {
        return cli;
    }
}

function randomua() {
    const platforms = ['Windows NT 10.0; Win64; x64', 'Windows NT 6.1; WOW64', 'Macintosh; Intel Mac OS X 10_15_7', 'X11; Linux x86_64', 'iPhone; CPU iPhone OS 16_0 like Mac OS X', 'Android 13; Mobile'];
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'];
    const chromeVersions = () => `${Math.floor(Math.random()*120)}.0.${Math.floor(Math.random()*9999)}.${Math.floor(Math.random()*999)}`;
    const firefoxVersions = () => `${Math.floor(Math.random()*100)}.0`;
    const safariVersions = () => `${Math.floor(Math.random()*605)}.${Math.floor(Math.random()*50)}.${Math.floor(Math.random()*50)}`;

    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const browser = browsers[Math.floor(Math.random() * browsers.length)];

    let ua = '';

    switch(browser) {
        case 'Chrome':
            ua = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersions()} Safari/537.36`;
            break;
        case 'Firefox':
            ua = `Mozilla/5.0 (${platform}; rv:${firefoxVersions()}) Gecko/20100101 Firefox/${firefoxVersions()}`;
            break;
        case 'Safari':
            ua = `Mozilla/5.0 (${platform}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safariVersions()} Safari/605.1.15`;
            break;
        case 'Edge':
            ua = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersions()} Safari/537.36 Edg/${chromeVersions()}`;
            break;
        case 'Opera':
            ua = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersions()} Opera/${chromeVersions()}`;
            break;
    }

    return ua;
}


async function sendPin(cli) {
    try {
        const response = await axios.post(
            'https://smart1216.robi.com.bd/robi_sivr/public/login/phone',
            {
                'cli': number(cli)
            },
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Content-Type': 'application/json; application/json;charset=UTF-8',
                    'sec-ch-ua-platform': '"macOS"',
                    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                    'sec-ch-ua-mobile': '?0',
                    'origin': 'https://smart1216.robi.com.bd',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'referer': 'https://smart1216.robi.com.bd/robisivr/login',
                    'accept-language': 'en-US,en;q=0.9,bn;q=0.8,id;q=0.7,zh-CN;q=0.6,zh;q=0.5',
                    'priority': 'u=1, i',
                    'Cookie': 'language=BN; isLanguageChecked=true; sound=ON;'
                }
            }
        );
        console.log(`PIN sent to ${cli}: ${response.data}`);
        if (response.data.errorCode === 1000) {
            return {
                success: true,
                message: response.data.message
            }
        } else {
            return {
                success: false,
                message: response.data.message
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.message || 'Unknown error'
        };
    }
}

async function verifyPin(cli, pin) {
    try {
        const response = await axios.post(
            'https://smart1216.robi.com.bd/robi_sivr/public/login/pin',
            {
                'cli': number(cli),
                'pin': pin
            },
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Content-Type': 'application/json; application/json;charset=UTF-8',
                    'sec-ch-ua-platform': '"macOS"',
                    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                    'sec-ch-ua-mobile': '?0',
                    'origin': 'https://smart1216.robi.com.bd',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'referer': 'https://smart1216.robi.com.bd/robisivr/pin',
                    'accept-language': 'en-US,en;q=0.9,bn;q=0.8,id;q=0.7,zh-CN;q=0.6,zh;q=0.5',
                    'priority': 'u=1, i',
                    'Cookie': `language=BN; isLanguageChecked=true; sound=ON; cli=${number(cli)}`
                }
            }
        );
        if (response.data.errorCode === 1002) {
            console.log(`PIN verified for ${cli}: ${response.data}`);
            return {
                success: true,
                message: response.data.message,
                token: response.data.data.token,
                key: response.data.data.key,
                cli: response.data.data.cli,
            };
        } else {
            return {
                success: false,
                message: response.data.message
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.message || 'Unknown error'
        };
    }
}

async function getHome(lang, cli, token, key) {
    try {
        const errors = { lang: 'Language is required bn or en', cli: 'Phone number is required', key: 'Key is required' };
    // Default language to BN if not provided or invalid
    const language = (!lang || !['en', 'bn', 'EN', 'BN'].includes(lang)) ? 'BN' : lang.toUpperCase();
    if (!cli) return { success: false, message: errors.cli };
    if (!key) return { success: false, message: errors.key };
        if (!cli) return { success: false, message: errors.cli };
        if (!key) return { success: false, message: errors.key };
        const response = await axios.post(
            'https://smart1216.robi.com.bd/robi_sivr/public/vivr-data',
            {
                'cli': number(cli),
                'key': key
            },
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Content-Type': 'application/json; application/json;charset=UTF-8',
                    'sec-ch-ua-platform': '"macOS"',
                    'authorization': `Bearer ${token}`,
                    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                    'sec-ch-ua-mobile': '?0',
                    'origin': 'https://smart1216.robi.com.bd',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'referer': 'https://smart1216.robi.com.bd/robisivr/home',
                    'accept-language': 'en-US,en;q=0.9,bn;q=0.8,id;q=0.7,zh-CN;q=0.6,zh;q=0.5',
                    'priority': 'u=1, i',
                    'Cookie': `language=${language}; isLanguageChecked=true; sound=ON; cli=${number(cli)}; token=${token}; key=${key}`
                }
            }
        );
        // Defensive: check response.data and response.data.pageContent
        if (response.data.errorCode === 1000 || response.data.errorCode === 1005) {
            const pageContent = Array.isArray(response.data.data?.pageContent) ? response.data.data.pageContent : [];
            // Ensure each element includes tableHead and tableData if present
            const elements = pageContent.map(el => {
                let obj = {
                    elementId: el.elementId,
                    elementType: el.elementType,
                    displayText: (language === 'BN' && el.displayTextBN) ? el.displayTextBN : (el.displayTextEN || el.displayTextBN || null)
                };
                if (el.elementType === 'table') {
                    obj.tableHead = el.tableHead || null;
                    obj.tableData = el.tableData || null;
                    obj.displayTextBN = el.displayTextBN || null;
                    obj.displayText = el.displayText || obj.displayText;
                }
                return obj;
            });
            // If no actionable elements/buttons, treat as failed page
            if (elements.length === 0) {
                return {
                    success: false,
                    message: response.data.message || 'No actionable elements found',
                    data: {
                        ...response.data.data,
                        elements
                    }
                };
            }
            return {
                success: true,
                message: response.data.message,
                data: {
                    ...response.data.data,
                    elements
                }
            };
        } else {
            return {
                success: false,
                message: response.data.message
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.message || 'Unknown error'
        };
    }
}


async function getPageData(cli, previousPage, buttonId, token, key, lang) {
    try {
        // Default language to BN if not provided or invalid
        const language = (!lang || !['BN', 'EN', 'bn', 'en'].includes(lang)) ? 'BN' : (lang.toUpperCase());
        const response = await axios.post(
            'https://smart1216.robi.com.bd/robi_sivr/public/vivr-data',
            {
                'previousPage': previousPage,
                'buttonId': buttonId,
                'buttonValue': '',
                'action': '',
                'userInput': '""',
                'language': language,
                'sound': 'OFF',
                'key': key
            },
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Content-Type': 'application/json; application/json;charset=UTF-8',
                    'sec-ch-ua-platform': '"macOS"',
                    'authorization': `Bearer ${token}`,
                    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                    'sec-ch-ua-mobile': '?0',
                    'origin': 'https://smart1216.robi.com.bd',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    'referer': 'https://smart1216.robi.com.bd/robisivr/home',
                    'accept-language': 'en-US,en;q=0.9,bn;q=0.8,id;q=0.7,zh-CN;q=0.6,zh;q=0.5',
                    'priority': 'u=1, i',
                    'Cookie': `cli=${cli}; token=${token}; key=${key}; sound=OFF; language=${language}; isLanguageChecked=false`
                }
            }
        );
        if (response.data.message === "Page Data Returned Successfully") {
            // Defensive: check for pageContent existence and type
            const pageContent = Array.isArray(response.data.data?.pageContent) ? response.data.data.pageContent : [];
            // Ensure each element includes tableHead and tableData if present
            const elements = pageContent.map(el => {
                let obj = {
                    elementId: el.elementId,
                    elementType: el.elementType,
                    displayText: (language === 'BN') ? el.displayTextBN || el.displayTextEN || null : el.displayTextEN || el.displayTextBN || null
                };
                if (el.elementType === 'table') {
                    obj.tableHead = el.tableHead || null;
                    obj.tableData = el.tableData || null;
                    obj.displayTextBN = el.displayTextBN || null;
                    obj.displayText = el.displayText || obj.displayText;
                }
                return obj;
            });
            // If no actionable elements/buttons, treat as failed page
            if (elements.length === 0) {
                return {
                    success: false,
                    message: response.data.message || 'No actionable elements found',
                    data: {
                        elements
                    }
                };
            }
            return {
                success: true,
                message: response.data.message,
                data: {
                    elements
                }
            };
        } else {
            return {
                success: false,
                message: response.data.message
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.message || 'Unknown error'
        };
    }
}
module.exports = {
    number,
    randomua,
    sendPin,
    verifyPin,
    getHome,
    getPageData
};

