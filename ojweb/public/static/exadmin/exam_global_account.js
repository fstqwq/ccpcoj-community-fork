/**
 * 全局考生账号管理导出功能
 * 提供总表导出、分考试导出、分考场导出功能
 */

(function() {
    'use strict';

    // 确保 zip.js 已配置
    if (typeof window.CsgZipEnsureConfigured === 'function') {
        window.CsgZipEnsureConfigured();
    }

    /**
     * 清理文件名，去除不合法字符
     * @param {string} filename - 原始文件名
     * @returns {string} 清理后的文件名
     */
    function sanitizeFilename(filename) {
        if (!filename) return 'unknown';
        // 过滤非合法文件名字符，空格替换为下划线
        return filename.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "_");
    }

    /**
     * 生成时间戳字符串 (YYYYMMDDHHMMSS)
     * @returns {string} 时间戳
     */
    function generateTimestamp() {
        const now = new Date();
        return now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, "0") +
            now.getDate().toString().padStart(2, "0") +
            now.getHours().toString().padStart(2, "0") +
            now.getMinutes().toString().padStart(2, "0") +
            now.getSeconds().toString().padStart(2, "0");
    }

    /**
     * 生成文件名（带前缀和后缀）
     * @param {string} prefix - 前缀（如"考试："或"考场："）
     * @param {string} name - 名称
     * @returns {string} 生成的文件名
     */
    function generateFilename(prefix, name) {
        const sanitized = sanitizeFilename(name);
        const timestamp = generateTimestamp();
        return `${prefix}${sanitized}-${timestamp}`;
    }

    /**
     * 从考试标题中提取真实标题（去除 # 前缀）
     * @param {string} title - 考试标题
     * @returns {string} 真实标题
     */
    function extractContestTitle(title) {
        if (!title) return '未知考试';
        const idx = title.indexOf('#');
        if (idx !== -1) {
            return title.slice(idx + 1);
        }
        return title;
    }

    /**
     * 导出单个 Excel 文件（复用 account_gen.js 的导出逻辑）
     * @param {Array} teamList - 考生列表
     * @param {string} title - 标题
     * @returns {Promise<Blob>} Excel 文件的 Blob
     */
    async function exportSingleExcel(teamList, title) {
        // 复用 account_gen.js 中的 ExportTeamgenTable 函数
        // 但我们需要直接返回 Blob 而不是下载
        const workbook = new ExcelJS.Workbook();
        
        // 先创建原有的通用子表（保持"密码条-含姓名"在第一个）
        SheetWithName(teamList, title, workbook.addWorksheet("密码条-含姓名"));
        SheetSimple(teamList, title, workbook.addWorksheet("密码条-表格"));
        SheetPage(
            teamList,
            title,
            workbook.addWorksheet("密码条-分页（横向打印）")
        );
        SheetFull(teamList, title, workbook.addWorksheet("完整数据"));
        
        // 统计所有不同的考场（trim后）
        const roomSet = new Set();
        teamList.forEach(team => {
            const room = (team.room || "").trim();
            roomSet.add(room);
        });
        const uniqueRooms = Array.from(roomSet);
        const hasMultipleRooms = uniqueRooms.length > 1;
        
        // 如果有多于1个不同的考场，为每个考场生成单独的子表（放在后面）
        if (hasMultipleRooms) {
            uniqueRooms.forEach(room => {
                // 过滤出该考场的考生
                const roomTeamList = teamList.filter(team => {
                    const teamRoom = (team.room || "").trim();
                    return teamRoom === room;
                });
                
                if (roomTeamList.length > 0) {
                    // 生成子表名称：空考场为"考场：#"，其他为"考场：考场名"
                    const sheetName = room === "" ? "考场：#" : `考场：${room}`;
                    // 显示用的考场名称：空考场显示为"#"
                    const displayRoomName = room === "" ? "#" : room;
                    SheetWithName(roomTeamList, title, workbook.addWorksheet(sheetName), displayRoomName);
                }
            });
        }

        // 生成 Excel Blob
        const buffer = await workbook.xlsx.writeBuffer();
        return new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
    }

    /**
     * 导出总表
     * @param {Array} teamList - 所有考生列表
     * @param {Object} contestMap - 考试映射 {contest_id: {contest_id, title}}
     */
    async function exportTotal(teamList, contestMap) {
        if (!teamList || teamList.length === 0) {
            window.alerty.error("没有数据可导出", "No data to export");
            return;
        }

        try {
            // 使用第一个考试的标题作为总表标题，或者使用通用标题
            let title = "全局考生账号";
            if (teamList.length > 0 && teamList[0].contest_id) {
                const firstContest = contestMap[teamList[0].contest_id];
                if (firstContest && firstContest.title) {
                    title = extractContestTitle(firstContest.title);
                }
            }

            const blob = await exportSingleExcel(teamList, title);
            const timestamp = generateTimestamp();
            const filename = `全局考生账号-${timestamp}.xlsx`;

            // 下载文件
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            window.alerty.success("总表导出成功", "Total export successful");
        } catch (error) {
            console.error("导出总表失败:", error);
            window.alerty.error("导出总表失败: " + error.message, "Total export failed: " + error.message);
        }
    }

    /**
     * 分考试导出
     * @param {Array} teamList - 所有考生列表
     * @param {Object} contestMap - 考试映射 {contest_id: {contest_id, title}}
     */
    async function exportByContest(teamList, contestMap) {
        if (!teamList || teamList.length === 0) {
            window.alerty.error("没有数据可导出", "No data to export");
            return;
        }

        try {
            // 按考试分组
            const contestGroups = {};
            teamList.forEach(team => {
                const cid = team.contest_id;
                if (!contestGroups[cid]) {
                    contestGroups[cid] = [];
                }
                contestGroups[cid].push(team);
            });

            const timestamp = generateTimestamp();
            const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));

            // 为每个考试生成 Excel 文件
            const exportPromises = Object.keys(contestGroups).map(async (cid) => {
                const contest = contestMap[cid];
                const contestTitle = contest ? extractContestTitle(contest.title) : `考试${cid}`;
                const filename = generateFilename("考试：", contestTitle) + ".xlsx";
                
                const teamListForContest = contestGroups[cid];
                const blob = await exportSingleExcel(teamListForContest, contestTitle);
                
                // 添加到 zip
                await zipWriter.add(filename, new zip.BlobReader(blob));
            });

            await Promise.all(exportPromises);

            // 生成并下载 zip 文件
            const zipBlob = await zipWriter.close();
            const zipFilename = `分考试导出-${timestamp}.zip`;
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = zipFilename;
            a.click();
            URL.revokeObjectURL(url);

            window.alerty.success("分考试导出成功", "Export by contest successful");
        } catch (error) {
            console.error("分考试导出失败:", error);
            window.alerty.error("分考试导出失败: " + error.message, "Export by contest failed: " + error.message);
        }
    }

    /**
     * 分考场导出
     * @param {Array} teamList - 所有考生列表
     * @param {Object} contestMap - 考试映射 {contest_id: {contest_id, title}}
     */
    async function exportByRoom(teamList, contestMap) {
        if (!teamList || teamList.length === 0) {
            window.alerty.error("没有数据可导出", "No data to export");
            return;
        }

        try {
            // 按考场分组（考场可能为空字符串）
            const roomGroups = {};
            teamList.forEach(team => {
                const room = (team.room || "").trim();
                const roomKey = room === "" ? "#" : room;
                if (!roomGroups[roomKey]) {
                    roomGroups[roomKey] = [];
                }
                roomGroups[roomKey].push(team);
            });

            const timestamp = generateTimestamp();
            const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));

            // 为每个考场生成 Excel 文件
            const exportPromises = Object.keys(roomGroups).map(async (roomKey) => {
                const roomName = roomKey === "#" ? "#" : roomKey;
                const filename = generateFilename("考场：", roomName) + ".xlsx";
                
                const teamListForRoom = roomGroups[roomKey];
                // 使用第一个考生的考试标题作为标题，或者使用通用标题
                let title = "考生账号";
                if (teamListForRoom.length > 0 && teamListForRoom[0].contest_id) {
                    const contest = contestMap[teamListForRoom[0].contest_id];
                    if (contest && contest.title) {
                        title = extractContestTitle(contest.title);
                    }
                }
                
                const blob = await exportSingleExcel(teamListForRoom, title);
                
                // 添加到 zip
                await zipWriter.add(filename, new zip.BlobReader(blob));
            });

            await Promise.all(exportPromises);

            // 生成并下载 zip 文件
            const zipBlob = await zipWriter.close();
            const zipFilename = `分考场导出-${timestamp}.zip`;
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = zipFilename;
            a.click();
            URL.revokeObjectURL(url);

            window.alerty.success("分考场导出成功", "Export by room successful");
        } catch (error) {
            console.error("分考场导出失败:", error);
            window.alerty.error("分考场导出失败: " + error.message, "Export by room failed: " + error.message);
        }
    }

    // 导出到全局命名空间
    window.GlobalAccountExport = {
        exportTotal: exportTotal,
        exportByContest: exportByContest,
        exportByRoom: exportByRoom
    };

})();
