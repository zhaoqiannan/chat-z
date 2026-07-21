import { post, getToken } from "@/utils/rest";

export const ChatApi = {
    chat: '/api/chat'
}

export const postChat = async (data: any) => {
    return await post(ChatApi.chat, data);
}

export const postChatStream = async (data: any, onChunk: (text: string) => void, signal?: AbortSignal) => {
    const baseApi = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const token = getToken();
    
    const response = await fetch(`${baseApi}${ChatApi.chat}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data),
        signal
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Request failed with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");

    if (!reader) {
        throw new Error("Response body is not readable");
    }

    let isSSE = false;
    let checkedSSE = false;
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        if (!checkedSSE) {
            checkedSSE = true;
            if (chunk.includes('data:')) {
                isSSE = true;
            }
        }

        if (isSSE) {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.startsWith('data:')) {
                    const dataContent = trimmed.slice(5).trim();
                    if (dataContent === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(dataContent);
                        const text = parsed.text || parsed.content || parsed.response || parsed.result || '';
                        if (text) onChunk(text);
                    } catch (e) {
                        onChunk(dataContent);
                    }
                }
            }
        } else {
            onChunk(chunk);
        }
    }

    if (isSSE && buffer) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
            const dataContent = trimmed.slice(5).trim();
            if (dataContent !== '[DONE]') {
                try {
                    const parsed = JSON.parse(dataContent);
                    const text = parsed.text || parsed.content || parsed.response || parsed.result || '';
                    if (text) onChunk(text);
                } catch (e) {
                    onChunk(dataContent);
                }
            }
        }
    }
};