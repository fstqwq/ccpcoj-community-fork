#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试查重系统：模拟实际查重流程，包括exclude_user_id过滤
用法：python3 test_similarity_with_exclude.py <problem_id> <solution_id_1> <solution_id_2> [exclude_user_id]
示例：python3 test_similarity_with_exclude.py 1315 412620 415235 202400205026
"""

import sys
import os

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.similarity_checker import WinnowingChecker

def find_code_file(problem_id, solution_id, code_base_dir="/judge/code"):
    """查找代码文件"""
    problem_dir = os.path.join(code_base_dir, str(problem_id))
    if not os.path.exists(problem_dir):
        return None
    
    for root, dirs, files in os.walk(problem_dir):
        for file in files:
            if file.startswith(f"{solution_id}_"):
                return os.path.join(root, file)
    return None

def extract_user_id_from_filename(filename):
    """从文件名提取user_id"""
    # 格式：solution_id_user_id.ext
    basename = os.path.basename(filename)
    parts = basename.split('_')
    if len(parts) >= 2:
        return parts[1].split('.')[0]
    return None

def main():
    if len(sys.argv) < 4:
        print("用法: python3 test_similarity_with_exclude.py <problem_id> <solution_id_1> <solution_id_2> [exclude_user_id]")
        print("示例: python3 test_similarity_with_exclude.py 1315 412620 415235 202400205026")
        sys.exit(1)
    
    problem_id = int(sys.argv[1])
    solution_id_1 = int(sys.argv[2])
    solution_id_2 = int(sys.argv[3])
    exclude_user_id = sys.argv[4] if len(sys.argv) > 4 else None
    
    code_base_dir = "/judge/code"
    language = 'cpp'
    
    print("=" * 60)
    print(f"测试查重系统（模拟实际流程）")
    print(f"problem_id={problem_id}, solution_id_1={solution_id_1}, solution_id_2={solution_id_2}")
    if exclude_user_id:
        print(f"exclude_user_id={exclude_user_id}")
    print("=" * 60)
    
    # 查找代码文件
    file1 = find_code_file(problem_id, solution_id_1, code_base_dir)
    file2 = find_code_file(problem_id, solution_id_2, code_base_dir)
    
    if not file1 or not file2:
        print(f"❌ 找不到代码文件")
        sys.exit(1)
    
    user_id_1 = extract_user_id_from_filename(file1)
    user_id_2 = extract_user_id_from_filename(file2)
    
    print(f"代码文件1: {file1}")
    print(f"  用户ID: {user_id_1}")
    print(f"代码文件2: {file2}")
    print(f"  用户ID: {user_id_2}")
    print()
    
    # 读取代码
    with open(file1, 'r', encoding='utf-8', errors='ignore') as f:
        code1 = f.read()
    with open(file2, 'r', encoding='utf-8', errors='ignore') as f:
        code2 = f.read()
    
    # 模拟实际查重流程
    print("模拟实际查重流程（查重solution_id_2时，查找solution_id_1）:")
    print(f"1. 加载历史代码（max_solution_id={solution_id_2}, exclude_user_id={exclude_user_id or user_id_2}）")
    
    checker = WinnowingChecker(k=5, w=4)
    problem_code_dir = os.path.join(code_base_dir, str(problem_id))
    
    # 模拟load_codes_from_directory
    exclude_user = exclude_user_id if exclude_user_id else user_id_2
    
    # 遍历目录，加载符合条件的代码
    loaded_count = 0
    for root, dirs, files in os.walk(problem_code_dir):
        for file in files:
            if not file.endswith(('.c', '.cpp')):
                continue
            
            try:
                file_parts = file.split('_')
                if len(file_parts) < 2:
                    continue
                
                file_solution_id = int(file_parts[0])
                
                # 检查max_solution_id
                if file_solution_id >= solution_id_2:
                    print(f"   跳过 {file}: solution_id {file_solution_id} >= {solution_id_2}")
                    continue
                
                # 检查exclude_user_id
                if exclude_user and exclude_user in file:
                    print(f"   跳过 {file}: 属于排除的用户 {exclude_user}")
                    continue
                
                # 加载代码
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    code = f.read()
                checker.add_code(file_solution_id, code, language=language)
                loaded_count += 1
                print(f"   ✓ 加载 {file} (solution_id={file_solution_id})")
            except Exception as e:
                print(f"   ❌ 加载 {file} 失败: {e}")
    
    print(f"\n   共加载 {loaded_count} 个历史代码")
    print(f"   内存中的指纹数量: {len(checker.code_fingerprints)}")
    print()
    
    # 检查solution_id_1是否被加载
    if solution_id_1 in checker.code_fingerprints:
        print(f"   ✓ solution_id_1 ({solution_id_1}) 已被加载")
    else:
        print(f"   ❌ solution_id_1 ({solution_id_1}) 未被加载")
        print(f"   这是问题所在！")
        # 检查原因
        file1_name = os.path.basename(file1)
        if solution_id_1 >= solution_id_2:
            print(f"   原因: solution_id_1 ({solution_id_1}) >= solution_id_2 ({solution_id_2})")
        if exclude_user and exclude_user in file1_name:
            print(f"   原因: 文件 {file1_name} 属于排除的用户 {exclude_user}")
    print()
    
    # 查找相似代码
    print(f"2. 查找与代码2相似的代码（threshold=80.0）")
    similarities = checker.find_similar_codes(code2, threshold=80.0, top_k=10, language=language)
    print(f"   找到 {len(similarities)} 个相似代码")
    
    if similarities:
        for sim in similarities:
            print(f"     solution_id={sim['solution_id']}, similarity={sim['similarity']:.2f}%")
        
        found = any(sim['solution_id'] == solution_id_1 for sim in similarities)
        if found:
            sim_data = next(sim for sim in similarities if sim['solution_id'] == solution_id_1)
            print(f"\n   ✓ 找到了代码1 (solution_id={solution_id_1})")
            print(f"   相似度: {sim_data['similarity']:.2f}%")
            print("   ✓ 查重系统工作正常")
        else:
            print(f"\n   ❌ 没有找到代码1 (solution_id={solution_id_1})")
            print("   这是问题所在！")
    else:
        print("   ❌ 没有找到任何相似代码")
        print("   这是问题所在！")
    print()
    
    # 直接计算相似度
    print("3. 直接计算代码1和代码2的相似度（用于对比）")
    fp1 = checker.compute_fingerprints(code1, language=language)
    fp2 = checker.compute_fingerprints(code2, language=language)
    direct_similarity = checker.similarity_score(fp1, fp2)
    print(f"   直接相似度: {direct_similarity:.2f}%")
    print()

if __name__ == '__main__':
    main()

