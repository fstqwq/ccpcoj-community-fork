<input type="hidden" id="page_item" value="{$controller}">
<script type="text/javascript">
    $(document).off('click',  '.change_status');
    $(document).on('click',  '.change_status', function(){
        var button = $(this);
        var item_name = button.attr('item_name');
        if(!item_name) item_name = $('#page_item').val();
        const item_id = button.attr('itemid');
        $.get(
            '/{$module}/itemstatuschange/change_status_ajax',
            {
                'item': item_name,
                'id': button.attr('itemid'),
                'field': button.attr('field'),
                'status': button.attr('status') == '1' ? '0' : '1'
            },
            function(ret) {
                if(ret.code == 1) {
                    let data = ret.data;
                    alerty.success({
                        message: `${item_id} 状态已更改为 ${data['status_str']}`,
                        message_en: "Successfully changed to " + data['status_str']
                    });
                    button.attr('status', data['status']);
                    button.removeClass(`btn-${data.status_class_rmv}`).addClass(`btn-${data.status_class}`);
                    
                    // 根据字段类型和状态重新构建双语显示
                    let field = button.attr('field');
                    let status = data['status'];
                    let bilingualText = '';
                    let iconClass = '';
                    
                    if (field === 'defunct') {
                        // 公开/隐藏：默认仅图标（列表格等）；带 data-change-status-defunct-ui="bilingual" 时与 changestatus_button 页眉一致
                        if (status == '0') {
                            iconClass = 'bi bi-unlock-fill';
                        } else {
                            iconClass = 'bi bi-lock-fill';
                        }
                        var defunctUi = button.attr('data-change-status-defunct-ui');
                        if (defunctUi === 'bilingual') {
                            var enLabel = (status == '0' || status === 0) ? 'Public' : 'Hidden';
                            bilingualText = '<span class="cn-text"><i class="' + iconClass + ' "></i></span><span class="en-text">' + enLabel + '</span>';
                            iconClass = '';
                        } else {
                            bilingualText = '';
                        }
                    } else if (field === 'archived') {
                        // 归档状态：仅图标，无文字
                        if (status == '0') {
                            iconClass = 'bi bi-archive';
                        } else {
                            iconClass = 'bi bi-archive-fill';
                        }
                        bilingualText = '';
                    } else if (field === 'private') {
                        // 私有状态
                        if (status == '0') {
                            iconClass = 'bi bi-globe ';
                            bilingualText = '<span class="en-text">Public</span>';
                        } else {
                            iconClass = 'bi bi-lock ';
                            bilingualText = '<span class="en-text">Private</span>';
                        }
                    } else {
                        // 默认使用后台返回的文本
                        bilingualText = data['status_str'];
                    }
                    
                    if (iconClass && bilingualText) {
                        button.html('<i class="' + iconClass + '"></i>' + bilingualText);
                    } else if (bilingualText) {
                        button.html(bilingualText);
                    } else {
                        button.html('<i class="' + iconClass + '"></i>');
                    }
                    
                    // 更新 title：当前为X，点击改为Y（避免“禁用”等词被误读为操作）
                    var nextStatus = (status == '0' || status === 0) ? '1' : '0';
                    var nextStatusText = '';
                    var nextStatusTextEn = '';
                    var titleUpdated = false;
                    
                    if (field === 'defunct') {
                        var defunctUiTitle = button.attr('data-change-status-defunct-ui');
                        var newTitle;
                        if (defunctUiTitle === 'bilingual') {
                            newTitle = (status == '0' || status === 0)
                                ? '点击切换为隐藏状态 (Click to switch to Hidden)'
                                : '点击切换为公开状态 (Click to switch to Public)';
                        } else {
                            nextStatusText = (nextStatus == '0') ? '公开' : '隐藏';
                            nextStatusTextEn = (nextStatus == '0') ? 'Public' : 'Hidden';
                            var currentText = (status == '0' || status === 0) ? '公开' : '隐藏';
                            var currentTextEn = (status == '0' || status === 0) ? 'Public' : 'Hidden';
                            newTitle = '当前为' + currentText + '，点击改为' + nextStatusText + ' (' + currentTextEn + ', click to change to ' + nextStatusTextEn + ')';
                        }
                        button.attr('title', newTitle);
                        if (window.autoTooltips && window.autoTooltips.updateElement) window.autoTooltips.updateElement(button[0], newTitle);
                        titleUpdated = true;
                    } else if (field === 'archived') {
                        nextStatusText = (nextStatus == '0') ? '未归档' : '已归档';
                        nextStatusTextEn = (nextStatus == '0') ? 'UnArchive' : 'Archived';
                        var currentText = (status == '1' || status === 1) ? '已归档' : '未归档';
                        var currentTextEn = (status == '1' || status === 1) ? 'Archived' : 'UnArchive';
                        var newTitle = '当前为' + currentText + '，点击改为' + nextStatusText + ' (' + currentTextEn + ', click to change to ' + nextStatusTextEn + ')';
                        button.attr('title', newTitle);
                        if (window.autoTooltips && window.autoTooltips.updateElement) window.autoTooltips.updateElement(button[0], newTitle);
                        titleUpdated = true;
                    } else if (field === 'private') {
                        if (nextStatus == '0') {
                            nextStatusText = '公开';
                            nextStatusTextEn = 'Public';
                        } else {
                            nextStatusText = '私有';
                            nextStatusTextEn = 'Private';
                        }
                    }
                    
                    if (!titleUpdated && nextStatusText) {
                        var currentText = (status == '0' || status === 0) ? '公开' : '私有';
                        var currentTextEn = (status == '0' || status === 0) ? 'Public' : 'Private';
                        var newTitle = '当前为' + currentText + '，点击改为' + nextStatusText + ' (' + currentTextEn + ', click to change to ' + nextStatusTextEn + ')';
                        button.attr('title', newTitle);
                        if (window.autoTooltips && window.autoTooltips.updateElement) window.autoTooltips.updateElement(button[0], newTitle);
                    }
                } else {
                    alerty.error({
                        message: ret?.msg,
                        message_en: ret?.msg ?? ''
                    });
                }
            },
            'json'
        );

    });
</script>