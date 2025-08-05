import json
import os


def merge_flower_data(main_file='flowers.json', supplement_file='supplementary_flowers.json'):
    """
    安全地将补充花语数据合并到主文件中。

    Args:
        main_file (str): 主数据文件名 (e.g., 'flowers.json').
        supplement_file (str): 补充数据文件名 (e.g., 'supplementary_flowers.json').
    """
    # --- 1. 检查文件是否存在 ---
    if not os.path.exists(main_file):
        print(f"错误：主文件 '{main_file}' 不存在。请检查文件名和路径。")
        return
    if not os.path.exists(supplement_file):
        print(f"错误：补充文件 '{supplement_file}' 不存在。请检查文件名和路径。")
        return

    try:
        # --- 2. 读取主文件和补充文件 ---
        with open(main_file, 'r', encoding='utf-8') as f:
            main_data = json.load(f)

        with open(supplement_file, 'r', encoding='utf-8') as f:
            supplement_data = json.load(f)

        # --- 3. 创建现有花名的集合以便快速查找 ---
        # 确保 main_data['flowers'] 是一个列表
        if 'flowers' not in main_data or not isinstance(main_data['flowers'], list):
            print(f"错误：主文件 '{main_file}' 的格式不正确，缺少 'flowers' 列表。")
            return

        existing_flower_names = {flower['name'] for flower in main_data['flowers']}

        # --- 4. 安全合并数据 ---
        new_flowers_added = 0

        # 确保 supplement_data['flowers'] 是一个列表
        if 'flowers' not in supplement_data or not isinstance(supplement_data['flowers'], list):
            print(f"错误：补充文件 '{supplement_file}' 的格式不正确，缺少 'flowers' 列表。")
            return

        for flower in supplement_data['flowers']:
            # 只有当花名不存在时才添加
            if flower.get('name') and flower['name'] not in existing_flower_names:
                main_data['flowers'].append(flower)
                existing_flower_names.add(flower['name'])  # 同时更新集合
                new_flowers_added += 1

        # --- 5. 如果有更新，则写回主文件 ---
        if new_flowers_added > 0:
            with open(main_file, 'w', encoding='utf-8') as f:
                # 使用 indent=2 保持JSON格式美观
                json.dump(main_data, f, ensure_ascii=False, indent=2)
            print(f"合并完成！成功添加了 {new_flowers_added} 个新的花名到 '{main_file}'。")
        else:
            print("没有新的花名需要添加。主文件内容未改变。")

    except json.JSONDecodeError:
        print("错误：JSON文件格式不正确，请检查文件内容。")
    except Exception as e:
        print(f"发生了一个未知错误: {e}")


# --- 运行主函数 ---
if __name__ == "__main__":
    merge_flower_data()