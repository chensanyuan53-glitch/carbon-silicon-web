
import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/supabaseClient';
import { Page } from './types';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Station } from './pages/Station';
import { Arena } from './pages/Arena';
import { Tasks } from './pages/Tasks';
import { Square } from './pages/Square';
import { SquareDetail } from './pages/SquareDetail';
import { Market } from './pages/Market';
import { MarketDetail } from './pages/MarketDetail';
import { Register } from './pages/Register';
import { Profile } from './pages/Profile';
import { ResetPassword } from './pages/ResetPassword';
import { AIChat } from './components/AIChat';
import { ChatDialog } from './components/ChatDialog';

interface ChatTask {
  taskId: string;
  taskTitle: string;
  otherUserId: string;
  otherUserName: string;
  currentUserId: string;
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>(Page.HOME);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  // 3. 新增：用来存储当前登录的用户信息
  const [session, setSession] = useState<Session | null>(null);
  const [chatDialog, setChatDialog] = useState<{ isOpen: boolean; chat: ChatTask | null }>({ isOpen: false, chat: null });
  const [stationTab, setStationTab] = useState<string | null>(null);

  // 4. 新增：核心逻辑！监听登录状态变化
  useEffect(() => {
    // 页面加载时，先问问 Supabase：现在有人登录吗？
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 开启监听器：一旦有人 登录/注册/退出，立刻更新 session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      // 如果检测到刚登录成功，自动跳转到首页（可选）
      if (session && currentPage === Page.REGISTER) {
        setCurrentPage(Page.HOME);
      }
    });

    // 页面关闭时取消监听
    return () => subscription.unsubscribe();
  }, [currentPage]);

    // 检查 URL 参数，如果有 topic 或 product 则跳转到对应详情页
    useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const topicParam = urlParams.get('topic');
      const productParam = urlParams.get('product');
      const tabParam = urlParams.get('tab');

      if (productParam) {
        setCurrentPage(Page.MARKET);
        setSelectedProductId(productParam);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (topicParam) {
        setCurrentPage(Page.SQUARE);
        setSelectedTopicId(topicParam);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (tabParam && tabParam === 'learning') {
        setCurrentPage(Page.STATION);
        setStationTab('learning');
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // 检查是否是重置密码页面
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      const error = hashParams.get('error');

      console.log('URL hash:', window.location.hash);
      console.log('Hash params:', { type, error });

      // 如果是重置密码链接，无论成功与否都跳转到重置密码页面
      if (type === 'recovery' || error === 'access_denied' || window.location.pathname === '/reset-password') {
        setCurrentPage(Page.RESET_PASSWORD);
      }
    }, []);

  const renderPage = () => {
    // 如果有选中的话题 ID，显示话题详情页
    if (currentPage === Page.SQUARE && selectedTopicId) {
      return <SquareDetail topicId={selectedTopicId} onBack={() => setSelectedTopicId(null)} />;
    }

    // 如果有选中的商品 ID，显示商品详情页
    if (currentPage === Page.MARKET && selectedProductId) {
      return <MarketDetail productId={selectedProductId} onBack={() => setSelectedProductId(null)} />;
    }

    switch (currentPage) {
      case Page.HOME:
        return <Home onNavigate={setCurrentPage} />;
      case Page.STATION:
        return <Station initialTab={stationTab} />;
      case Page.ARENA:
        return <Arena />;
      case Page.TASKS:
        return <Tasks onOpenChat={(chat) => setChatDialog({ isOpen: true, chat })} />;
      case Page.SQUARE:
        return <Square onTopicSelect={setSelectedTopicId} />;
      case Page.MARKET:
        return <Market onProductSelect={setSelectedProductId} />;
      case Page.REGISTER:
        return <Register onNavigate={setCurrentPage} />;
      case Page.PROFILE:
        return <Profile onNavigate={setCurrentPage} />;
      case Page.RESET_PASSWORD:
        return <ResetPassword onNavigate={setCurrentPage} />;
      default:
        return <Home onNavigate={setCurrentPage} />;
    }
  };

  const handleOpenChat = (chat: ChatTask) => {
    setChatDialog({ isOpen: true, chat });
  };

  return (
    <div className="bg-slate-900 min-h-screen font-sans text-slate-100">
      {/* 5. 把 session 传给 Navbar，让它根据状态变脸 */}
      <Navbar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        session={session}
        onOpenChat={handleOpenChat}
      />

      <main>
        {renderPage()}
      </main>

      {/* Global AI Assistant */}
      <AIChat />

      {/* Chat Dialog - 在 App 层级渲染，避免被 Navbar 遮挡 */}
      {chatDialog.isOpen && chatDialog.chat && (
        <ChatDialog
          isOpen={chatDialog.isOpen}
          onClose={() => setChatDialog({ isOpen: false, chat: null })}
          taskId={chatDialog.chat.taskId}
          taskTitle={chatDialog.chat.taskTitle}
          otherUserId={chatDialog.chat.otherUserId}
          otherUserName={chatDialog.chat.otherUserName}
          currentUserId={chatDialog.chat.currentUserId}
        />
      )}

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12 text-slate-400 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4 text-white font-bold text-lg">
               <div className="w-6 h-6 rounded bg-gradient-to-tr from-orange-500 to-red-500 flex items-center justify-center text-xs">CS</div>
               碳硅合创
            </div>
            <p className="mb-4">打破行业壁垒，重塑行业生态。</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">平台</h4>
            <ul className="space-y-2">
              <li><button onClick={() => setCurrentPage(Page.STATION)} className="hover:text-white">情报站</button></li>
              <li><button onClick={() => setCurrentPage(Page.ARENA)} className="hover:text-white">竞技场</button></li>
              <li><button onClick={() => setCurrentPage(Page.TASKS)} className="hover:text-white">任务大厅</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">资源</h4>
            <ul className="space-y-2">
              <li><button onClick={() => { setCurrentPage(Page.STATION); setStationTab('learning'); }} className="hover:text-white">AI 工具集</button></li>
              <li><a href="#" className="hover:text-white">开发者文档</a></li>
              <li><a href="#" className="hover:text-white">社区公约</a></li>
              <li><a href="https://community.cssymbiosis.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white">碳硅合创·龙虾塘</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">联系</h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-white">关于我们</a></li>
              <li><a href="#" className="hover:text-white">商业合作</a></li>
              <li><a href="#" className="hover:text-white">意见反馈</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-slate-800 text-center">
          &copy; 2024 碳硅合创. 保留所有权利.
        </div>
      </footer>
    </div>
  );
}

export default App;