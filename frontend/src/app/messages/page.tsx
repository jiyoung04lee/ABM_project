"use client";

import { User } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import api from "@/shared/api/axios";

interface Conversation {
  id: number;
  other_user: {
    id: number;
    name: string;
    info?: string;
  };
  last_message: string;
  last_date?: string;
  unread_count: number;
}

interface Message {
  id: number;
  sender: number;
  sender_name: string;
  content: string;
  created_at: string;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const myId =
    typeof window !== "undefined"
      ? Number(localStorage.getItem("user_id"))
      : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 대화 목록
  const fetchConversations = async () => {
    try {
      const res = await api.get("/messages/conversations/");
      const data = res.data.results || res.data;

      const formatted = data.map((c: any) => ({
        id: c.id,
        other_user: {
          id: c.other_user.id,
          name: c.other_user.name,
          info: c.other_user.info || "",
        },
        last_message: c.last_message || "",
        last_date: c.last_date || "",
        unread_count: c.unread_count || 0,
      }));

      setConversations(formatted);
    } catch (err) {
      console.error("대화 목록 불러오기 실패", err);
    }
  };

  // 메시지 조회
  const fetchMessages = async (conversationId: number) => {
    try {
      const res = await api.get(
        `/messages/conversations/${conversationId}/messages/`
      );

      const formatted = res.data.map((m: any) => ({
        id: m.id,
        sender: m.sender,
        sender_name: m.sender_name,
        content: m.content,
        created_at: new Date(m.created_at).toLocaleString(),
      }));

      setMessages(formatted);
    } catch (err) {
      console.error("메시지 불러오기 실패", err);
    }
  };

  // 대화 선택
  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);

    await fetchMessages(conv.id);

    // 백에서 자동 읽음 처리 → 다시 목록 갱신
    await fetchConversations();
  };

  // 메시지 전송
  const handleSendMessage = async () => {
    if (!replyText.trim() || !selectedConversation) return;

    try {
      await api.post("/messages/messages/", {
        conversation: selectedConversation.id,
        content: replyText,
      });

      setReplyText("");

      await fetchMessages(selectedConversation.id);
      await fetchConversations();
    } catch (err) {
      console.error("메시지 전송 실패", err);
    }
  };

  // Enter 전송
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  return (
    <div className="max-w-6xl w-full px-4 text-left">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 ml-2">메시지</h1>

      <div className="grid grid-cols-12 gap-6 h-[750px]">
        {/* 대화 목록 */}
        <div className="col-span-4 bg-white rounded-[24px] border border-[#E5E7EB] overflow-hidden flex flex-col shadow-sm">
          <div className="overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`w-full p-6 text-left border-b border-[#E5E7EB] flex items-start gap-4 transition-colors ${
                  selectedConversation?.id === conv.id
                    ? "bg-[#F8FAFF]"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="w-12 h-12 bg-[#2B7FFF] rounded-full flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-gray-900">
                        {conv.other_user.name}
                      </span>

                      {conv.unread_count > 0 && (
                        <div className="w-1.5 h-1.5 bg-[#FF4D4F] rounded-full" />
                      )}
                    </div>

                    <span className="text-[11px] text-gray-400">
                      {conv.last_date}
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 truncate">
                    {conv.last_message}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="col-span-8 bg-white rounded-[24px] border border-[#E5E7EB] flex flex-col overflow-hidden shadow-sm">
          {selectedConversation ? (
            <>
              {/* 헤더 */}
              <div className="p-6 border-b border-[#E5E7EB] flex items-center gap-4">
                <div className="w-12 h-12 bg-[#2B7FFF] rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>

                <div className="text-left">
                  <div className="font-bold text-lg text-gray-900">
                    {selectedConversation.other_user.name}
                  </div>

                  <div className="text-xs text-gray-400">
                    {selectedConversation.other_user.info}
                  </div>
                </div>
              </div>

              {/* 메시지 */}
              <div className="flex-1 p-8 overflow-y-auto space-y-6 bg-white">
                {messages.map((msg) => {
                  const isMe = msg.sender === myId;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        isMe ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] ${
                          isMe ? "items-end" : "items-start"
                        } flex flex-col`}
                      >
                        <div
                          className={`px-5 py-3 rounded-[18px] text-[14px] leading-relaxed ${
                            isMe
                              ? "bg-[#2B7FFF] text-white rounded-tr-none"
                              : "bg-[#F1F3F5] text-gray-800 rounded-tl-none"
                          }`}
                        >
                          {msg.content}
                        </div>

                        <span className="text-[11px] text-gray-400 mt-2 px-1">
                          {msg.created_at}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>

              {/* 입력 */}
              <div className="border-t border-[#E5E7EB] p-6 bg-white">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="메시지를 입력하세요..."
                      className="w-full bg-white border border-[#E5E7EB] rounded-full py-4 px-8 text-[15px] focus:outline-none focus:border-[#2B7FFF]"
                    />
                  </div>

                  <button
                    onClick={handleSendMessage}
                    className="w-14 h-14 bg-[#2B7FFF] rounded-full flex items-center justify-center hover:opacity-90 transition-opacity shrink-0 shadow-md"
                  >
                    <Image
                      src="/icons/send.svg"
                      alt="전송"
                      width={22}
                      height={22}
                    />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 bg-white">
              메시지를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}