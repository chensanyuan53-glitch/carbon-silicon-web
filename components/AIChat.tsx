import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { MessageSquare, X, Send, Loader2, Sparkles } from 'lucide-react';

export const AIChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: '你好！我是碳硅合创的 AI 助手。你是“新知先锋”还是“行业领航员”？我可以帮你寻找队友、推荐工具或构思方案。' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const toggleChat = () => setIsOpen(!isOpen);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      if (!chatRef.current) {
        if (!process.env.API_KEY) {
            setMessages(prev => [...prev, { role: 'model', text: '未检测到 API Key。请检查配置。' }]);
            setIsLoading(false);
            return;
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        chatRef.current = ai.chats.create({
          model: 'gemini-3-flash-preview',
          config: {
            systemInstruction: `You are the AI assistant for the "Carbon-Silicon" (碳硅合创) community. 
            This community connects "Tech Adopters" (AI experts) with "Domain Experts" (Industry veterans).
            Your goal is to help users navigate the platform, suggest tools (like Midjourney, ComfyUI), brainstorm ideas for competitions (like Home Design), and help them form teams.
            Keep responses concise, helpful, and encouraging. Use Chinese language.`,
          },
        });
      }

      const response = await chatRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: response.text || '我正在思考...' }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: '抱歉，我现在有点忙，请稍后再试。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white p-4 rounded-full shadow-lg hover:shadow-cyan-500/50 transition-all transform hover:scale-105 flex items-center gap-2"
        >
          <Sparkles size={24} />
          <span className="font-semibold hidden md:inline">AI 助手</span>
        </button>
      )}

      {isOpen && (
        <div className="bg-slate-900 border border-slate-700 w-80 md:w-96 h-[500px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <span className="font-semibold text-white">碳硅 AI 助手</span>
            </div>
            <button onClick={toggleChat} className="text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/95">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-700">
                  <Loader2 size={16} className="animate-spin text-cyan-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="输入你的问题..."
              className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-full transition-colors disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};