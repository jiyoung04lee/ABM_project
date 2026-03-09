"use client";

import { User, Headphones } from "lucide-react";
import { useEffect, useState, useRef, Suspense } from "react";
import Image from "next/image";
import api from "@/shared/api/axios";
import { useSearchParams } from "next/navigation";

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

function MessagesPageContent(){
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("userId");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [contactingAdmin, setContactingAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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

  // 대화 목록 조회
  const fetchConversations = async (): Promise<Conversation[]> => {
    try {
      const res = await api.get("messages/conversations/");
      const data = res.data.results || res.data;

      const formatted = data.map((c: any) => ({
        id: c.id,
        other_user: {
          id: c.other_user?.id,
          name: c.other_user?.name,
          info: c.other_user?.info || "",
        },
        last_message: c.last_message || "",
        last_date: c.last_date || "",
        unread_count: c.unread_count || 0,
      }));

      setConversations(formatted);
      return formatted;
    } catch (err) {
      console.error("대화 목록 불러오기 실패", err);
      return [];
    }
  };

  // 메시지 조회
  const fetchMessages = async (conversationId: number) => {
    try {
      const res = await api.get(
        `messages/conversations/${conversationId}/messages/`
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
    await fetchConversations();
  };

  // 메시지 전송
  const handleSendMessage = async () => {
    if (!replyText.trim() || !selectedConversation) return;

    try {
      await api.post("messages/messages/", {
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

  // 새 대화 생성
  const createConversation = async (userId: number) => {
    try {
      await api.post("messages/conversations/", {
        user_id: userId,
      });
    } catch (err) {
      console.error("대화 생성 실패", err);
    }
  };

  // 관리자에게 문의: 대화 시작 후 선택
  const handleContactAdmin = async () => {
    setContactingAdmin(true);
    try {
      const adminRes = await api.get("users/admin-info/");
      const adminId = adminRes.data.id;
      const convRes = await api.post("messages/start/", { user_id: adminId });
      const conv: Conversation = {
        id: convRes.data.id,
        other_user: {
          id: adminRes.data.id,
          name: adminRes.data.name,
          info: "관리자",
        },
        last_message: convRes.data.last_message || "",
        unread_count: convRes.data.unread_count || 0,
      };
      await fetchConversations();
      setSelectedConversation(conv);
      await fetchMessages(conv.id);
    } catch {
      alert("관리자에게 문의하기에 실패했습니다.");
    } finally {
      setContactingAdmin(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    fetchConversations();
  }, []);

  // userId로 자동 채팅 생성
  useEffect(() => {
    if (!targetUserId) return;
    if (conversations.length === 0) return;

    const userId = Number(targetUserId);

    const existing = conversations.find(
      (c) => c.other_user && c.other_user.id === userId
    );

    if (existing) {
      handleSelectConversation(existing);
      return;
    }

    createConversation(userId).then(async () => {
      const updated = await fetchConversations();

      const created = updated.find(
        (c) => c.other_user && c.other_user.id === userId
      );

      if (created) {
        handleSelectConversation(created);
      }
    });
  }, [targetUserId, conversations]);

  useEffect(() => {
    api.get("users/me/").then((res) => setIsAdmin(!!res.data?.is_staff)).catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl w-full px-4 text-left">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 ml-2">메시지</h1>

      <div className="grid grid-cols-12 gap-6 h-[750px]">

        {/* 대화 목록 */}
        <div className="col-span-4 bg-white rounded-[24px] border border-[#E5E7EB] overflow-hidden flex flex-col shadow-sm">
          {/* 일반 사용자만: 관리자에게 문의하기 버튼 (관리자는 대화 목록만) */}
          {!isAdmin && (
            <div className="px-4 pt-4 pb-2">
              <button
                type="button"
                onClick={handleContactAdmin}
                disabled={contactingAdmin}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#2563EB] to-[#8B5CF6] text-white hover:shadow-md transition-all disabled:opacity-60"
              >
                <Headphones className="w-4 h-4" />
                {contactingAdmin ? "연결 중..." : "관리자에게 문의하기"}
              </button>
            </div>
          )}
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
                    <span className="font-bold text-gray-900">
                      {conv.other_user?.name}
                    </span>

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
              <div className="p-6 border-b border-[#E5E7EB] flex items-center gap-4">
                <div className="w-12 h-12 bg-[#2B7FFF] rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>

                <div>
                  <div className="font-bold text-lg text-gray-900">
                    {selectedConversation.other_user?.name}
                  </div>

                  <div className="text-xs text-gray-400">
                    {selectedConversation.other_user?.info}
                  </div>
                </div>
              </div>

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
                        className={`max-w-[75%] flex flex-col ${
                          isMe ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`px-5 py-3 rounded-[18px] text-[14px] ${
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

              <div className="border-t border-[#E5E7EB] p-6 bg-white">
                <div className="flex items-center gap-4">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 border border-[#E5E7EB] rounded-full py-4 px-8 text-[15px] focus:outline-none focus:border-[#2B7FFF]"
                  />

                  <button
                    onClick={handleSendMessage}
                    className="w-14 h-14 bg-[#2B7FFF] rounded-full flex items-center justify-center"
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
            <div className="flex-1 flex items-center justify-center text-gray-400">
              메시지를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">로딩중...</div>}>
      <MessagesPageContent />
    </Suspense>
  );
}