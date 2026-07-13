import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquareCode, X, Send, Sparkles, Loader2, ArrowUpRight } from 'lucide-react';
import api from '../utils/api';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  invoices?: any[];
  stats?: {
    count: number;
    total: number;
    average: number;
  };
  explanation?: string;
}

export const AIAssistant: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your AI Finance Assistant. You can ask me questions about your invoices, and I will fetch real data from the database. Try asking:\n• "Show pending invoices"\n• "Find AWS invoices"\n• "Show invoices above 50,000"\n• "How much did we spend last month?"',
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsgText = input.trim();
    setInput('');
    setError('');

    // Append user message
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMsgText,
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const data = await api.post('/invoices/assistant-query', { query: userMsgText });
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: data.summary,
        invoices: data.invoices,
        stats: data.stats,
        explanation: data.explanation,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: 'Sorry, I encountered an error querying the database. Please verify the backend connection.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const [error, setError] = useState('');

  return (
    <>
      {/* Floating Action Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 p-4 bg-primary hover:bg-primary-hover text-white rounded-full shadow-lg hover:shadow-primary/25 z-40 transition-all duration-300 hover:scale-110 flex items-center justify-center pulse-light"
      >
        <MessageSquareCode size={24} />
      </button>

      {/* Slide-out Panel */}
      <div
        className={`fixed top-0 right-0 h-screen w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 transition-transform duration-300 flex flex-col justify-between ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
              <Sparkles size={16} />
            </div>
            <span className="font-bold text-sm text-slate-800 dark:text-white">
              AI Finance Assistant
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`p-3 rounded-xl text-sm leading-relaxed max-w-[85%] whitespace-pre-line ${
                  msg.sender === 'user'
                    ? 'bg-primary text-white font-medium rounded-tr-none'
                    : 'bg-slate-100 dark:bg-slate-850 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/50 dark:border-slate-800'
                }`}
              >
                {msg.text}
              </div>

              {/* Dynamic stats display */}
              {msg.stats && msg.stats.count > 0 && (
                <div className="mt-2 w-[85%] p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/40 dark:border-slate-800/40 text-xs font-semibold space-y-1.5">
                  <div className="flex justify-between text-slate-500">
                    <span>Count matched</span>
                    <span>{msg.stats.count} invoices</span>
                  </div>
                  <div className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>Grand Sum</span>
                    <span>INR {msg.stats.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Average Value</span>
                    <span>INR {msg.stats.average.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {/* Dynamic invoices list results links */}
              {msg.invoices && msg.invoices.length > 0 && (
                <div className="mt-2 w-[85%] space-y-2.5">
                  <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block">
                    Matching Ledger Records ({msg.invoices.length})
                  </span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {msg.invoices.map((inv) => (
                      <button
                        key={inv.id}
                        onClick={() => {
                          setIsOpen(false);
                          navigate(`/invoices/${inv.id}`);
                        }}
                        className="w-full p-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-800 rounded-lg text-left text-xs font-semibold flex items-center justify-between text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
                      >
                        <div className="truncate pr-2">
                          <span className="font-bold text-slate-900 dark:text-white block">{inv.invoiceNumber}</span>
                          <span className="text-2xs text-slate-400">{inv.vendorName || 'Unknown Vendor'}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 flex-shrink-0 text-slate-800 dark:text-white">
                          <span>{inv.currency} {inv.grandTotal.toFixed(2)}</span>
                          <ArrowUpRight size={12} className="text-slate-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing Loading Skeleton */}
          {loading && (
            <div className="flex items-start space-x-2">
              <div className="p-3 rounded-xl bg-slate-105 border border-slate-200/50 text-slate-500 rounded-tl-none flex items-center space-x-1.5">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs font-semibold">Querying database...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about spend, status, vendors..."
            className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary placeholder-slate-400"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2 bg-primary hover:bg-primary-hover text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </>
  );
};
