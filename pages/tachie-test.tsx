import TachieGenerator from "@/components/TachieGenerator";

export default function TachieTestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-cyan-100 py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-purple-800">
          立绘生成测试页面
        </h1>

        <TachieGenerator prompt="可爱的魔法少女，长着粉色头发，穿着蓝色裙子，手持魔法棒，动漫风格" />

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-600">
            这是一个测试页面，用于测试 TachieGenerator 组件的功能
          </p>
          <p className="text-xs text-gray-500 mt-2">
            需要有效的 LibLib Access Key 和 Secret Key 才能进行图片生成
          </p>
        </div>
      </div>
    </div>
  );
}