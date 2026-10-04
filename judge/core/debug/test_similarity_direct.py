#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
直接测试查重系统：检查两个代码文件是否能被正确识别为100%相似
用法：python3 test_similarity_direct.py <problem_id> <solution_id_1> <solution_id_2> [language]
示例：python3 test_similarity_direct.py 1315 412620 415235 cpp
"""

import sys
import os

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.similarity_checker import WinnowingChecker

def find_code_file(problem_id, solution_id, code_base_dir="/judge/code"):
    """
    查找代码文件
    文件路径格式：{code_base_dir}/{problem_id}/{prefix}/{solution_id}_{user_id}.ext
    """
    problem_dir = os.path.join(code_base_dir, str(problem_id))
    if not os.path.exists(problem_dir):
        return None
    
    # 遍历所有子目录
    for root, dirs, files in os.walk(problem_dir):
        for file in files:
            if file.startswith(f"{solution_id}_"):
                return os.path.join(root, file)
    return None

def main():
    if len(sys.argv) < 4:
        print("用法: python3 test_similarity_direct.py <problem_id> <solution_id_1> <solution_id_2> [language]")
        print("示例: python3 test_similarity_direct.py 1315 412620 415235 cpp")
        sys.exit(1)
    
    problem_id = int(sys.argv[1])
    solution_id_1 = int(sys.argv[2])
    solution_id_2 = int(sys.argv[3])
    language = sys.argv[4] if len(sys.argv) > 4 else 'cpp'
    
    code_base_dir = "/judge/code"
    
    print("=" * 60)
    print(f"测试查重系统：problem_id={problem_id}, solution_id_1={solution_id_1}, solution_id_2={solution_id_2}")
    print("=" * 60)
    
    # 查找代码文件
    file1 = find_code_file(problem_id, solution_id_1, code_base_dir)
    file2 = find_code_file(problem_id, solution_id_2, code_base_dir)
    
    if not file1:
        print(f"❌ 找不到 solution_id={solution_id_1} 的代码文件")
        print(f"   搜索目录: {os.path.join(code_base_dir, str(problem_id))}")
        sys.exit(1)
    
    if not file2:
        print(f"❌ 找不到 solution_id={solution_id_2} 的代码文件")
        print(f"   搜索目录: {os.path.join(code_base_dir, str(problem_id))}")
        sys.exit(1)
    
    print(f"✓ 找到代码文件1: {file1}")
    print(f"✓ 找到代码文件2: {file2}")
    print()
    
    # 读取代码
    try:
        with open(file1, 'r', encoding='utf-8', errors='ignore') as f:
            code1 = f.read()
        with open(file2, 'r', encoding='utf-8', errors='ignore') as f:
            code2 = f.read()
    except Exception as e:
        print(f"❌ 读取代码文件失败: {e}")
        sys.exit(1)
    
    print(f"代码1长度: {len(code1)} 字符")
    print(f"代码2长度: {len(code2)} 字符")
    
    # 检查内容是否完全相同
    if code1 == code2:
        print("✓ 两个文件内容完全相同")
    else:
        print("⚠️  两个文件内容不完全相同")
        lines1 = code1.split('\n')
        lines2 = code2.split('\n')
        diff_count = 0
        for i, (l1, l2) in enumerate(zip(lines1, lines2), 1):
            if l1 != l2:
                diff_count += 1
                if diff_count <= 3:
                    print(f"  第{i}行不同:")
                    print(f"    文件1: {repr(l1[:80])}")
                    print(f"    文件2: {repr(l2[:80])}")
        if len(lines1) != len(lines2):
            print(f"  行数不同: 文件1有{len(lines1)}行, 文件2有{len(lines2)}行")
        print(f"  总共有 {diff_count} 行不同")
    print()
    
    # 使用Winnowing算法测试
    print("使用Winnowing算法测试:")
    checker = WinnowingChecker(k=5, w=4)
    
    # 计算指纹
    fp1 = checker.compute_fingerprints(code1, language=language)
    fp2 = checker.compute_fingerprints(code2, language=language)
    
    # 计算相似度
    similarity = checker.similarity_score(fp1, fp2)
    
    print(f"  代码1指纹数量: {len(fp1)}")
    print(f"  代码2指纹数量: {len(fp2)}")
    print(f"  共同指纹数量: {len(fp1 & fp2)}")
    print(f"  并集指纹数量: {len(fp1 | fp2)}")
    print(f"  相似度: {similarity:.2f}%")
    print()
    
    # 模拟查重流程：先添加代码1，然后查找代码2
    print("模拟查重流程:")
    print(f"1. 添加代码1（solution_id={solution_id_1}）")
    checker.add_code(solution_id_1, code1, language=language)
    print(f"   已添加，指纹数量: {len(checker.code_fingerprints[solution_id_1])}")
    print()
    
    print(f"2. 查找与代码2相似的代码（threshold=80.0）")
    similarities = checker.find_similar_codes(code2, threshold=80.0, top_k=10, language=language)
    print(f"   找到 {len(similarities)} 个相似代码")
    
    if similarities:
        print("   相似代码列表:")
        for sim in similarities:
            print(f"     solution_id={sim['solution_id']}, similarity={sim['similarity']:.2f}%")
        
        # 检查是否找到了代码1
        found = any(sim['solution_id'] == solution_id_1 for sim in similarities)
        if found:
            sim_data = next(sim for sim in similarities if sim['solution_id'] == solution_id_1)
            print(f"\n   ✓ 找到了代码1 (solution_id={solution_id_1})")
            print(f"   相似度: {sim_data['similarity']:.2f}%")
            if sim_data['similarity'] >= 99.0:
                print("   ✓ 查重系统工作正常，能正确识别100%相似的代码")
            else:
                print(f"   ⚠️  相似度偏低，应该是100%或接近100%")
        else:
            print(f"\n   ❌ 没有找到代码1 (solution_id={solution_id_1})")
            print("   这是问题所在！")
    else:
        print("   ❌ 没有找到任何相似代码")
        print("   这是问题所在！")
    print()
    
    # 检查倒排索引
    print("3. 检查倒排索引:")
    print(f"   倒排索引大小: {len(checker.fingerprint_index)}")
    if fp1:
        # 检查代码1的指纹是否都在倒排索引中
        missing_fps = [fp for fp in fp1 if fp not in checker.fingerprint_index]
        if missing_fps:
            print(f"   ⚠️  代码1有 {len(missing_fps)} 个指纹不在倒排索引中")
        else:
            print(f"   ✓ 代码1的所有指纹都在倒排索引中")
        
        # 检查倒排索引中是否包含solution_id_1
        found_in_index = False
        for fp in fp1:
            if solution_id_1 in checker.fingerprint_index.get(fp, set()):
                found_in_index = True
                break
        if found_in_index:
            print(f"   ✓ 倒排索引中包含 solution_id={solution_id_1}")
        else:
            print(f"   ❌ 倒排索引中不包含 solution_id={solution_id_1}")
            print("   这是问题所在！")
    print()
    
    # 总结
    print("=" * 60)
    print("测试结果总结")
    print("=" * 60)
    
    if similarity >= 99.0:
        print("✓ 直接相似度计算正确（>=99%）")
        if similarities and any(sim['solution_id'] == solution_id_1 for sim in similarities):
            print("✓ 查重流程正常，能找到相同的代码")
            print("✓ 查重系统工作正常")
        else:
            print("❌ 查重流程有问题：直接相似度正确，但find_similar_codes找不到")
            print("   可能的原因：")
            print("   1. 倒排索引没有正确更新")
            print("   2. 阈值设置问题")
            print("   3. 指纹计算或存储有问题")
    else:
        print(f"❌ 直接相似度计算有问题：{similarity:.2f}%")
        print("   完全相同的代码应该接近100%相似")
        print("   可能的原因：")
        print("   1. 注释移除有问题")
        print("   2. token提取有问题")
        print("   3. 指纹计算有问题")

if __name__ == '__main__':
    main()

