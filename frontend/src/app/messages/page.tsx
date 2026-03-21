"use client";

import { User, Headphones, ChevronLeft } from "lucide-react";
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

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [breakpoint]);

  return isMobile;
}

function MessagesPageContent() {
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("userId");
  const targetNickname = searchParams.get("nickname");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [contactingAdmin, setContactingAdmin] = useState(false);
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myId, setMyId] = useState<number | null>(null);

  const sendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isMobile = useIsMobile();
  const showMobileChat = isMobile && !!selectedConversation;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatLastDate = (value?: string) => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");

    return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
  };

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
        last_date: formatLastDate(c.last_message_time || c.last_date || ""),
        unread_count: c.unread_count || 0,
      }));

      setConversations(formatted);
      return formatted;
    } catch (err) {
      console.error("대화 목록 불러오기 실패", err);
      return [];
    }
  };

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

  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    await fetchMessages(conv.id);
    await fetchConversations();
  };

  const handleSendMessage = async () => {
    if (sendingRef.current) return;
    if (!replyText.trim() || !selectedConversation) return;

    sendingRef.current = true;
    setSending(true);

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
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const createConversation = async (
    userId: number,
    nickname: string | null
  ): Promise<Conversation | null> => {
    try {
      const res = await api.post("messages/start/", {
        user_id: userId,
        nickname,
        isNickname: !!nickname,
      });

      const c = res.data;

      const conv: Conversation = {
        id: c.id,
        other_user: {
          id: c.other_user?.id,
          name: c.other_user?.name,
          info: c.other_user?.info || "",
        },
        last_message: c.last_message || "",
        last_date: formatLastDate(c.last_message_time || ""),
        unread_count: c.unread_count || 0,
      };

      setConversations((prev) => {
        const exists = prev.find((p) => p.id === conv.id);
        if (exists) {
          return prev.map((p) => (p.id === conv.id ? conv : p));
        }
        return [conv, ...prev];
      });

      return conv;
    } catch (err) {
      console.error("대화 생성 실패", err);
      return null;
    }
  };

  const handleContactAdmin = async () => {
    if (contactingAdmin) return;
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
        last_date: formatLastDate(convRes.data.last_message_time || convRes.data.last_date || ""),
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

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (!targetUserId) return;
    if (conversations.length === 0) return;

    const userId = Number(targetUserId);

    const existing = conversations.find((c) => {
      if (!c.other_user || c.other_user.id !== userId) return false;

      if (targetNickname) {
        return c.other_user.name === targetNickname;
      }

      return c.other_user.name !== targetNickname;
    });

    if (existing) {
      handleSelectConversation(existing);
      return;
    }

    createConversation(userId, targetNickname).then((created) => {
      if (created) {
        handleSelectConversation(created);
      }
    });
  }, [targetUserId, targetNickname, conversations]);

  useEffect(() => {
    api
      .get("users/me/")
      .then((res) => {
        setIsAdmin(!!res.data?.is_staff);
        if (res.data?.id) {
          const id = Number(res.data.id);
          localStorage.setItem("user_id", String(id));
          setMyId(id);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="w-full py-4 md:py-6">
      <div className="max-w-6xl mx-auto w-full px-3 md:px-4 text-left">
        {!isMobile && (
          <h1 className="text-2xl font-bold mb-6 text-gray-800 ml-2">메시지</h1>
        )}

        <div className="md:grid md:grid-cols-12 md:gap-6 md:h-[calc(100vh-180px)] md:min-h-[500px]">
          {/* 모바일: 목록 화면 */}
          {(!isMobile || !showMobileChat) && (
            <div className="md:col-span-4 bg-white rounded-[20px] md:rounded-[24px] border border-[#E5E7EB] overflow-hidden flex flex-col shadow-sm h-[calc(100vh-120px)] md:h-auto">
              <div className="px-4 pt-4 pb-3 border-b border-[#E5E7EB] md:border-b-0">
                <h1 className="text-xl font-bold text-gray-800 md:hidden">메시지</h1>

                {!isAdmin && (
                  <button
                    type="button"
                    onClick={handleContactAdmin}
                    disabled={contactingAdmin}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-[#2563EB] to-[#8B5CF6] text-white hover:shadow-md transition-all disabled:opacity-60"
                  >
                    <Headphones className="w-4 h-4" />
                    {contactingAdmin ? "연결 중..." : "관리자에게 문의하기"}
                  </button>
                )}
              </div>

              <div className="overflow-y-auto flex-1">
                {conversations.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400 px-4">
                    아직 대화가 없습니다
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`w-full px-4 py-4 md:p-6 text-left border-b border-[#E5E7EB] flex items-start gap-3 md:gap-4 transition-colors ${
                        selectedConversation?.id === conv.id
                          ? "bg-[#F8FAFF]"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="relative w-10 h-10 bg-[#2B7FFF] rounded-full flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-white" />
                        {conv.unread_count > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#EF4444] text-white text-[10px] rounded-full flex items-center justify-center ring-2 ring-white">
                            {conv.unread_count > 9 ? "9+" : conv.unread_count}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900 truncate">
                            {conv.other_user?.name}
                          </span>
                          <span className="text-[11px] text-gray-400 shrink-0">
                            {conv.last_date}
                          </span>
                        </div>

                        <p className="text-sm text-gray-500 truncate">
                          {conv.last_message || "메시지가 없습니다."}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 데스크탑: 우측 채팅 / 모바일: 전체 채팅 */}
          {(!isMobile || showMobileChat) && (
            <div className="md:col-span-8 bg-white rounded-[20px] md:rounded-[24px] border border-[#E5E7EB] flex flex-col overflow-hidden shadow-sm h-[calc(100vh-120px)] md:h-auto mt-3 md:mt-0">
              {selectedConversation ? (
                <>
                  <div className="p-4 md:p-6 border-b border-[#E5E7EB] flex items-center gap-3 md:gap-4">
                    {isMobile && (
                      <button
                        type="button"
                        onClick={() => setSelectedConversation(null)}
                        className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center shrink-0"
                        aria-label="뒤로가기"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-700" />
                      </button>
                    )}

                    <div className="w-10 h-10 bg-[#2B7FFF] rounded-full flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>

                    <div className="min-w-0">
                      <div className="font-bold text-base md:text-lg text-gray-900 truncate">
                        {selectedConversation.other_user?.name}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {selectedConversation.other_user?.info}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-4 md:space-y-6 bg-white">
                    {messages.map((msg) => {
                      const isMe = msg.sender === myId;

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] md:max-w-[75%] flex flex-col ${
                              isMe ? "items-end" : "items-start"
                            }`}
                          >
                            <span className="text-[11px] md:text-[12px] text-gray-500 mb-1 px-1">
                              {msg.sender_name}
                            </span>

                            <div
                              className={`px-4 py-3 md:px-5 md:py-3 rounded-[18px] text-[14px] leading-relaxed break-words whitespace-pre-wrap ${
                                isMe
                                  ? "bg-[#2B7FFF] text-white rounded-tr-none"
                                  : "bg-[#F1F3F5] text-gray-800 rounded-tl-none"
                              }`}
                            >
                              {msg.content}
                            </div>

                            <span className="text-[10px] md:text-[11px] text-gray-400 mt-2 px-1">
                              {msg.created_at}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    <div ref={messagesEndRef} />
                  </div>

                  <div className="border-t border-[#E5E7EB] p-3 md:p-6 bg-white">
                    <div className="flex items-center gap-2 md:gap-4">
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="메시지를 입력하세요..."
                        className="flex-1 border border-[#E5E7EB] rounded-full py-3 md:py-4 px-5 md:px-8 text-[14px] md:text-[15px] focus:outline-none focus:border-[#2B7FFF]"
                      />

                      <button
                        onClick={handleSendMessage}
                        disabled={sending}
                        className="w-12 h-12 md:w-14 md:h-14 bg-[#2B7FFF] rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        <Image
                          src="/icons/send.svg"
                          alt="전송"
                          width={20}
                          height={20}
                        />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm md:text-base">
                  메시지를 선택하세요
                </div>
              )}
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