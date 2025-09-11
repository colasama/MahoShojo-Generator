import React, { useState, useEffect, useRef } from 'react';
import TurnstileWidget, { TurnstileRef } from '../Turnstile';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (username: string, authKey: string, turnstileToken: string) => Promise<void>;
  onRegister: (username: string, code: string, turnstileToken: string) => Promise<void>;
  authMessage: { type: 'error' | 'success', text: string } | null;
  generatedAuthKey: string | null;
}

export default function AuthModal({
  isOpen,
  onClose,
  onLogin,
  onRegister,
  authMessage,
  generatedAuthKey
}: AuthModalProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', code: '', authKey: '' });
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileRef = useRef<TurnstileRef>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 重置表单当模态框关闭时
  useEffect(() => {
    if (!isOpen) {
      setAuthForm({ username: '', code: '', authKey: '' });
      setTurnstileToken('');
      setAuthMode('login');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // 监听认证消息变化
  useEffect(() => {
    if (authMessage && isSubmitting) {
      if (authMessage.type === 'error') {
        // 登录/注册失败，重置Turnstile以获取新token
        turnstileRef.current?.reset();
        setTurnstileToken('');
      } else if (authMessage.type === 'success') {
        // 登录/注册成功，保持当前状态
        // 模态框关闭会在父组件中处理
      }
      setIsSubmitting(false);
    }
  }, [authMessage, isSubmitting]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      return; // Turnstile验证必须完成
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'register') {
        await onRegister(authForm.username, authForm.code, turnstileToken);
      } else {
        await onLogin(authForm.username, authForm.authKey, turnstileToken);
      }
    } finally {
      // 如果没有错误，setIsSubmitting会在useEffect中处理
      // 如果有错误，也会在useEffect中处理并重置
    }
  };

  const switchMode = () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
    setAuthForm({ username: '', code: '', authKey: '' });
    setTurnstileToken(''); // 重置turnstile token
    turnstileRef.current?.reset(); // 重置turnstile组件
  };

  const handleTurnstileVerify = (token: string) => {
    setTurnstileToken(token);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
          aria-label="关闭"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-4 pr-8">
          {authMode === 'login' ? '登录' : '注册'}
        </h2>

        {authMessage && (
          <div className={`mb-4 p-3 rounded-md text-sm ${
            authMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {authMessage.text}
          </div>
        )}

        {generatedAuthKey && authMode === 'register' && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-sm font-semibold text-green-800 mb-2">
              您的登录密钥（请立即复制保存）：
            </p>
            <code className="block p-2 bg-white rounded text-xs break-all border border-green-300">
              {generatedAuthKey}
            </code>
            <p className="text-xs text-red-600 mt-2">
              ⚠️ 请勿和他人分享，如果丢失则无法找回
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedAuthKey);
              }}
              className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              复制密钥
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={authForm.username}
              onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
              className="input-field"
              placeholder="请输入用户名"
              required
            />
          </div>

          {authMode === 'register' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                验证码
              </label>
              <input
                type="text"
                value={authForm.code}
                onChange={(e) => setAuthForm({ ...authForm, code: e.target.value })}
                className="input-field"
                placeholder="请输入6位验证码"
                maxLength={6}
                required
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                登录密钥
              </label>
              <textarea
                value={authForm.authKey}
                onChange={(e) => setAuthForm({ ...authForm, authKey: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="请输入您的登录密钥"
                required
              />
            </div>
          )}

          {/* Turnstile验证码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              安全验证
            </label>
            <TurnstileWidget ref={turnstileRef} onVerify={handleTurnstileVerify} />
          </div>

          <button
            type="submit"
            disabled={!turnstileToken || isSubmitting}
            className={`w-full generate-button ${(!turnstileToken || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? '验证中...' : (authMode === 'login' ? '登录' : '注册')}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          {authMode === 'login' ? '还没有账号？' : '已有账号？'}
          <button
            onClick={switchMode}
            className="ml-1 text-purple-600 hover:text-purple-700 font-medium"
          >
            {authMode === 'login' ? '去注册' : '去登录'}
          </button>
        </div>
      </div>
    </div>
  );
}