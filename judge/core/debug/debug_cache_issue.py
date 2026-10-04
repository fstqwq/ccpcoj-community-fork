#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试缓存问题：检查为什么每次评测都提示缓存验证失败
"""

import sys
import os
import json
import time

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.similarity_checker import WinnowingChecker

def main():
    if len(sys.argv) < 2:
        print("用法: python3 debug_cache_issue.py <problem_id> [solution_id]")
        print("示例: python3 debug_cache_issue.py 1187 417800")
        sys.exit(1)
    
    problem_id = int(sys.argv[1])
    solution_id = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    code_base_dir = "/judge/code"
    cache_dir = code_base_dir
    
    print("=" * 70)
    print(f"调试缓存问题: problem_id={problem_id}")
    print("=" * 70)
    
    # 1. 检查缓存文件是否存在
    cache_file = os.path.join(cache_dir, str(problem_id), '.winnowing_cache_cpp.json')
    print(f"\n1. 缓存文件路径: {cache_file}")
    
    if os.path.exists(cache_file):
        print(f"   ✓ 缓存文件存在")
        stat = os.stat(cache_file)
        print(f"   文件大小: {stat.st_size} bytes")
        print(f"   修改时间: {time.ctime(stat.st_mtime)}")
        
        # 读取缓存内容
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            print(f"\n   缓存内容:")
            print(f"   - version: {cache_data.get('version')}")
            print(f"   - algorithm_version: {cache_data.get('algorithm_version')}")
            print(f"   - k: {cache_data.get('k')}")
            print(f"   - w: {cache_data.get('w')}")
            print(f"   - solution_ids数量: {len(cache_data.get('solution_ids', []))}")
            print(f"   - fingerprints数量: {len(cache_data.get('fingerprints', {}))}")
            print(f"   - last_updated: {cache_data.get('last_updated')}")
            
            # 显示前几个solution_id
            solution_ids = cache_data.get('solution_ids', [])[:5]
            print(f"   - 前5个solution_id: {solution_ids}")
            
        except Exception as e:
            print(f"   ❌ 读取缓存文件失败: {e}")
    else:
        print(f"   ❌ 缓存文件不存在")
    
    # 2. 创建WinnowingChecker
    print(f"\n2. 创建WinnowingChecker")
    checker = WinnowingChecker(k=5, w=4, cache_dir=cache_dir, use_multi_granularity=True)
    print(f"   算法版本: {checker.ALGORITHM_VERSION}")
    print(f"   k={checker.k}, w={checker.w}")
    print(f"   use_multi_granularity={checker.use_multi_granularity}")
    print(f"   coarse_k={checker.coarse_k}, coarse_w={checker.coarse_w}")
    
    # 3. 检查哈希函数
    print(f"\n3. 检查哈希函数")
    test_str = "test_string_for_hash"
    hash_val = checker._hash_string(test_str)
    print(f"   测试字符串: {test_str}")
    print(f"   哈希值: {hash_val}")
    
    # 多次计算，检查稳定性
    hash_vals = [checker._hash_string(test_str) for _ in range(5)]
    print(f"   多次计算: {hash_vals}")
    if len(set(hash_vals)) == 1:
        print(f"   ✓ 哈希函数在单次运行中稳定")
    else:
        print(f"   ❌ 哈希函数在单次运行中不稳定！")
    
    # 4. 检查哈希函数实现
    print(f"\n4. 检查哈希函数实现")
    import hashlib
    hash_bytes = hashlib.md5(test_str.encode('utf-8')).digest()[:4]
    expected_hash = int.from_bytes(hash_bytes, 'little') & 0x7FFFFFFF
    print(f"   使用hashlib.md5（统一实现）")
    print(f"   预期哈希值: {expected_hash}")
    print(f"   实际哈希值: {hash_val}")
    if hash_val == expected_hash:
        print(f"   ✓ 哈希函数实现正确")
    else:
        print(f"   ❌ 哈希函数实现不一致！")
    
    # 5. 测试指纹计算
    print(f"\n5. 测试指纹计算")
    test_code = """
#include <iostream>
using namespace std;
int main() {
    int n;
    cin >> n;
    for (int i = 0; i < n; i++) {
        cout << i << endl;
    }
    return 0;
}
"""
    fp = checker.compute_fingerprints(test_code, language='cpp')
    print(f"   测试代码指纹数量: {len(fp)}")
    print(f"   前10个指纹: {sorted(list(fp))[:10]}")
    
    # 多次计算，检查稳定性
    fp2 = checker.compute_fingerprints(test_code, language='cpp')
    if fp == fp2:
        print(f"   ✓ 指纹计算在单次运行中稳定")
    else:
        print(f"   ❌ 指纹计算在单次运行中不稳定！")
        print(f"   第一次: {len(fp)} 个指纹")
        print(f"   第二次: {len(fp2)} 个指纹")
        print(f"   共同指纹: {len(fp & fp2)}")
    
    # 6. 如果有缓存，验证缓存中的一个样本
    if os.path.exists(cache_file):
        print(f"\n6. 验证缓存样本")
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            cached_fingerprints = cache_data.get('fingerprints', {})
            if cached_fingerprints:
                # 取第一个样本
                sample_sid = list(cached_fingerprints.keys())[0]
                cached_fp = set(cached_fingerprints[sample_sid])
                
                print(f"   样本solution_id: {sample_sid}")
                print(f"   缓存指纹数量: {len(cached_fp)}")
                
                # 查找对应的代码文件
                problem_dir = os.path.join(code_base_dir, str(problem_id))
                found_file = None
                for root, dirs, files in os.walk(problem_dir):
                    for file in files:
                        if file.startswith(f"{sample_sid}_"):
                            found_file = os.path.join(root, file)
                            break
                    if found_file:
                        break
                
                if found_file:
                    print(f"   代码文件: {found_file}")
                    with open(found_file, 'r', encoding='utf-8', errors='ignore') as f:
                        code = f.read()
                    
                    # 重新计算指纹
                    new_fp = checker.compute_fingerprints(code, language='cpp')
                    print(f"   重新计算指纹数量: {len(new_fp)}")
                    
                    common_fp = cached_fp & new_fp
                    print(f"   共同指纹数量: {len(common_fp)}")
                    
                    if len(common_fp) == 0:
                        print(f"   ❌ 共同指纹为0，说明算法或哈希函数变化了")
                        print(f"   缓存前10个指纹: {sorted(list(cached_fp))[:10]}")
                        print(f"   新计算前10个指纹: {sorted(list(new_fp))[:10]}")
                    elif new_fp == cached_fp:
                        print(f"   ✓ 指纹完全匹配")
                    else:
                        print(f"   ⚠️  指纹不完全匹配，但有共同指纹")
                else:
                    print(f"   ❌ 找不到代码文件")
        except Exception as e:
            print(f"   ❌ 验证失败: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n" + "=" * 70)
    print("调试完成")
    print("=" * 70)

if __name__ == '__main__':
    main()

