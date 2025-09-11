import React from 'react';

interface SaveCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  name: string;
  description: string;
  isPublic: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPublicChange: (value: boolean) => void;
  error: string | null;
  isSaving?: boolean;
}

export default function SaveCardModal({
  isOpen,
  onClose,
  onSave,
  name,
  description,
  isPublic,
  onNameChange,
  onDescriptionChange,
  onPublicChange,
  error,
  isSaving = false
}: SaveCardModalProps) {
  if (!isOpen) return null;

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
        <h2 className="text-xl font-bold mb-4 pr-8">保存数据卡</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              数据卡名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="input-field"
              placeholder="请输入数据卡名称"
              maxLength={50}
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="input-field"
              rows={3}
              placeholder="请输入数据卡描述"
              maxLength={50}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="newCardPublic"
              checked={isPublic}
              onChange={(e) => onPublicChange(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded"
              disabled={isSaving}
            />
            <label htmlFor="newCardPublic" className="text-sm text-gray-700">
              设为公开（其他用户可见）
            </label>
          </div>

          {isPublic && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              ⚠️ 公开的数据卡将对所有用户可见
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={!name.trim() || isSaving}
              className={`flex-1 generate-button ${(!name.trim() || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={onClose}
              disabled={isSaving}
              className={`flex-1 generate-button ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                background: 'white',
                backgroundImage: 'none',
                color: '#6b7280',
                border: '2px solid #e5e7eb'
              }}
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}