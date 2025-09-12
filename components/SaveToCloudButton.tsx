import React, { useState } from 'react';
import SaveCardModal from './CharManager/SaveCardModal';

interface SaveToCloudButtonProps {
  data: any;
  buttonText?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function SaveToCloudButton({ 
  data, 
  buttonText = "保存到云端", 
  className = "generate-button",
  style = {}
}: SaveToCloudButtonProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardDescription, setCardDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 检查用户登录状态
  const checkLoginStatus = () => {
    // 这里需要根据实际的登录状态检查逻辑来实现
    // 暂时假设通过某种方式检查用户是否登录
    const isLoggedIn = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
    return !!isLoggedIn;
  };

  const handleSaveClick = () => {
    if (!checkLoginStatus()) {
      alert('请先登录后再保存到云端');
      return;
    }
    
    // 生成默认名称
    let defaultName = '';
    if (data.codename) {
      defaultName = `魔法少女_${data.codename}`;
    } else if (data.name) {
      defaultName = `残兽档案_${data.name}`;
    } else if (data.title) {
      defaultName = `情景_${data.title}`;
    } else {
      defaultName = '角色档案';
    }
    
    setCardName(defaultName);
    setCardDescription('');
    setIsPublic(false);
    setSaveError(null);
    setShowSaveModal(true);
  };

  const handleSave = async () => {
    if (!cardName.trim()) {
      setSaveError('请输入数据卡名称');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // 这里需要实现实际的保存到云端的API调用
      // 暂时模拟保存过程
      const response = await fetch('/api/save-to-cloud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('userToken') || sessionStorage.getItem('userToken')}`
        },
        body: JSON.stringify({
          name: cardName,
          description: cardDescription,
          isPublic,
          data
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '保存失败');
      }

      alert('保存到云端成功！');
      setShowSaveModal(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={handleSaveClick}
        className={className}
        style={style}
      >
        {buttonText}
      </button>

      <SaveCardModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSave}
        name={cardName}
        description={cardDescription}
        isPublic={isPublic}
        onNameChange={setCardName}
        onDescriptionChange={setCardDescription}
        onPublicChange={setIsPublic}
        error={saveError}
        isSaving={isSaving}
      />
    </>
  );
}