import { post, postStream } from "@/utils/rest";

export const ChatApi = {
    chat: '/api/chat'
}

export const postChat = async (data: any) => await post(ChatApi.chat, data);

export const postChatStream = async (data: any, onChunk: (text: string) => void, signal?: AbortSignal) => await postStream(ChatApi.chat, data, onChunk, signal)