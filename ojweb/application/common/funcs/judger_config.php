<?php
/**
 * 评测机配置相关函数
 *
 * 作用：
 * - 读取/写入评测机配置（默认配置 + 用户自定义 JSON）
 * - 深度合并与字段补全
 * - 配置数据校验（基于 definitions）
 * - JSON 字符串转数组工具（Json2Array）
 *
 * 依赖：
 * - ThinkPHP：`config()`, `\think\facade\Log`
 * - 文件系统：file_exists/file_get_contents/file_put_contents
 * - funcs 依赖：MakeDirs（来自 `file_utils.php`）
 *
 * 约束：
 * - 仅允许函数定义；禁止文件顶层执行任何逻辑。
 * - 由 `ojweb/application/common.php` 统一 require_once 引入，并确保 `file_utils.php` 在本文件之前加载。
 *
 * 导出函数：
 * - mergeJudgerConfig
 * - GetJudgerConfig
 * - ensureJudgerConfigComplete
 * - SetJudgerConfig
 * - validateJudgerConfig
 * - Json2Array
 */

/**
 * 深度合并配置数组，确保所有默认字段都被补全（向后兼容）
 * @param array $default 默认配置
 * @param array $custom 自定义配置
 * @return array 合并后的配置
 */
function mergeJudgerConfig($default, $custom) {
    $result = $default;
    
    foreach ($custom as $key => $value) {
        if (isset($result[$key]) && is_array($result[$key]) && is_array($value)) {
            // 递归合并数组
            $result[$key] = mergeJudgerConfig($result[$key], $value);
        } else {
            // 直接覆盖非数组值，或新增键
            $result[$key] = $value;
        }
    }
    
    return $result;
}

/**
 * 获取评测机配置
 * @param bool $flg_get_default 是否获取默认配置，默认false
 * @return array 评测机配置数组
 */
function GetJudgerConfig($flg_get_default = false) {
    // 加载默认配置（ThinkPHP 配置文件，一定存在）
    $defaultConfig = config('JudgeDefaultConfig.');
    
    // 确保 config 和 definitions 键存在
    if (!isset($defaultConfig['config']) || !is_array($defaultConfig['config'])) {
        $defaultConfig['config'] = [];
    }
    if (!isset($defaultConfig['definitions']) || !is_array($defaultConfig['definitions'])) {
        $defaultConfig['definitions'] = [];
    }
    
    // 先使用默认配置
    $config = $defaultConfig['config'];
    
    // 如果要求获取默认配置，直接返回
    if ($flg_get_default) {
        return [
            'config' => $config,
            'definitions' => $defaultConfig['definitions'],
            'load_success' => true
        ];
    }
    
    // 获取用户自定义配置文件路径（JSON文件，可能不存在或损坏）
    $configPath = config('OjPath.judger_config');
    $fullPath = config('OjPath.PUBLIC') . $configPath;
    
    $loadSuccess = true;
    
    // 尝试读取用户自定义配置文件（JSON）
    if (file_exists($fullPath)) {
        $configContent = file_get_contents($fullPath);
        if ($configContent !== false) {
            $jsonConfig = json_decode($configContent, true);
            if ($jsonConfig !== null && is_array($jsonConfig)) {
                // 配置文件存在且有效，使用深度合并覆盖默认配置
                // 先以默认配置为基础，再用自定义配置覆盖，这样新增的字段会自动补全
                $config = mergeJudgerConfig($config, $jsonConfig);
            } else {
                // 配置文件损坏，使用默认配置
                $loadSuccess = false;
                \think\facade\Log::warning('评测机配置文件损坏，使用默认配置: ' . $fullPath);
            }
        } else {
            // 无法读取配置文件，使用默认配置
            $loadSuccess = false;
            \think\facade\Log::warning('无法读取评测机配置文件，使用默认配置: ' . $fullPath);
        }
    } else {
        // 配置文件不存在，使用默认配置
        $loadSuccess = false;
    }
    
    // 如果配置文件不存在或损坏，尝试创建默认配置文件
    if (!$loadSuccess) {
        try {
            // 确保目录存在
            $dir = dirname($fullPath);
            if (!is_dir($dir)) {
                MakeDirs($dir);
            }
            
            // 写入默认配置（只写入实际配置数据）
            $jsonContent = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if (file_put_contents($fullPath, $jsonContent) !== false) {
                $loadSuccess = true;
            }
        } catch (Exception $e) {
            // 写入失败，但继续使用默认配置
            \think\facade\Log::warning('无法创建评测机配置文件，使用默认配置: ' . $e->getMessage());
        }
    }
    
    // 最终确保所有必需的分组和字段都存在（向后兼容性保障）
    // 如果默认配置为空，则跳过补全（避免错误）
    if (!empty($defaultConfig['config'])) {
        $config = ensureJudgerConfigComplete($config, $defaultConfig['config']);
    }
    // 返回完整配置（包含定义和实际配置）
    return [
        'config' => $config,
        'definitions' => $defaultConfig['definitions'],
        'load_success' => $loadSuccess
    ];
}

/**
 * 确保配置完整，补全缺失的分组和字段（向后兼容性保障）
 * @param array $config 当前配置
 * @param array $defaultConfig 默认配置
 * @return array 补全后的配置
 */
function ensureJudgerConfigComplete($config, $defaultConfig) {
    // 确保所有默认配置的分组都存在
    foreach ($defaultConfig as $sectionKey => $sectionDefault) {
        if (!isset($config[$sectionKey])) {
            // 如果分组不存在，使用默认值
            $config[$sectionKey] = $sectionDefault;
        } elseif (is_array($sectionDefault) && is_array($config[$sectionKey])) {
            // 如果分组存在，确保所有字段都存在
            foreach ($sectionDefault as $fieldKey => $fieldDefault) {
                if (!isset($config[$sectionKey][$fieldKey])) {
                    // 如果字段不存在，使用默认值
                    $config[$sectionKey][$fieldKey] = $fieldDefault;
                }
            }
        }
    }
    
    return $config;
}

/**
 * 设置评测机配置
 * @param array $configData 配置数据
 * @return array 返回结果 ['success' => bool, 'message' => string, 'data' => array]
 */
function SetJudgerConfig($configData) {
    try {
        // 获取默认配置用于验证
        $defaultConfig = config('JudgeDefaultConfig.');
        $definitions = $defaultConfig['definitions'];
        
        // 验证配置数据
        $validationResult = validateJudgerConfig($configData, $definitions);
        if (!$validationResult['success']) {
            return [
                'success' => false,
                'message' => $validationResult['message'],
                'data' => []
            ];
        }
        
        // 获取配置文件路径
        $configPath = config('OjPath.judger_config');
        $fullPath = config('OjPath.PUBLIC') . $configPath;
        
        // 确保目录存在
        $dir = dirname($fullPath);
        if (!is_dir($dir)) {
            if (!MakeDirs($dir)) {
                return [
                    'success' => false,
                    'message' => '无法创建配置目录',
                    'data' => []
                ];
            }
        }
        
        // 写入配置文件
        $jsonContent = json_encode($configData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if (file_put_contents($fullPath, $jsonContent) === false) {
            return [
                'success' => false,
                'message' => '配置文件写入失败',
                'data' => []
            ];
        }
        
        return [
            'success' => true,
            'message' => '配置保存成功',
            'data' => $configData
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => '配置保存失败：' . $e->getMessage(),
            'data' => []
        ];
    }
}

/**
 * 验证评测机配置
 * @param array $configData 配置数据
 * @param array $definitions 配置定义
 * @return array 验证结果 ['success' => bool, 'message' => string]
 */
function validateJudgerConfig($configData, $definitions) {
    // 检查必需的分组
    $requiredSections = ['common', 'c', 'cpp', 'java', 'python'];
    foreach ($requiredSections as $section) {
        if (!isset($configData[$section])) {
            return [
                'success' => false,
                'message' => "缺少必需的配置分组：{$section}"
            ];
        }
    }
    
    // 验证每个分组的字段
    foreach ($definitions as $sectionKey => $section) {
        if (!isset($configData[$sectionKey])) {
            continue; // 跳过不存在的分组
        }
        
        $sectionData = $configData[$sectionKey];
        
        foreach ($section['fields'] as $fieldKey => $field) {
            if (!isset($sectionData[$fieldKey])) {
                return [
                    'success' => false,
                    'message' => "配置分组 {$sectionKey} 缺少必需字段：{$fieldKey}"
                ];
            }
            
            $value = $sectionData[$fieldKey];
            
            // 根据字段类型验证
            if ($field['type'] === 'number') {
                // 宽松的数字验证
                if (!is_numeric($value) && !is_int($value) && !is_float($value) && !(is_string($value) && is_numeric(trim($value)))) {
                    return [
                        'success' => false,
                        'message' => "字段 {$sectionKey}.{$fieldKey} 必须是数字，当前值：{$value} (类型：" . gettype($value) . ")"
                    ];
                }
                
                $numValue = floatval($value);
                
                // 检查最小值
                if (isset($field['min']) && $numValue < $field['min']) {
                    return [
                        'success' => false,
                        'message' => "字段 {$sectionKey}.{$fieldKey} 不能小于 {$field['min']}"
                    ];
                }
                
                // 检查最大值
                if (isset($field['max']) && $numValue > $field['max']) {
                    return [
                        'success' => false,
                        'message' => "字段 {$sectionKey}.{$fieldKey} 不能大于 {$field['max']}"
                    ];
                }
                
            } elseif ($field['type'] === 'select') {
                // 检查选择值是否在允许的选项中
                $validValues = array_column($field['options'], 'value');
                if (!in_array($value, $validValues)) {
                    return [
                        'success' => false,
                        'message' => "字段 {$sectionKey}.{$fieldKey} 的值不在允许的选项中"
                    ];
                }
                
            } elseif ($field['type'] === 'switch') {
                // 开关类型应该是布尔值
                if (!is_bool($value) && !in_array($value, [0, 1, '0', '1', 'true', 'false'])) {
                    return [
                        'success' => false,
                        'message' => "字段 {$sectionKey}.{$fieldKey} 必须是布尔值"
                    ];
                }
            }
        }
    }
    
    return [
        'success' => true,
        'message' => '配置验证通过'
    ];
}

function Json2Array($str) {
    // 尝试解析 JSON 为数组（第二个参数 true 表示返回数组）
    $array = json_decode($str, true);
    // 获取解析错误码
    $error = json_last_error();
    // 无错误，或错误为 "语法错误" 以外的情况（如解析结果为 null 但原字符串是 "null"）
    if ($error === JSON_ERROR_NONE) {
        return $array; // 返回解析后的数组
    }
    // 解析失败，返回 false 或错误信息
    return false;
}


