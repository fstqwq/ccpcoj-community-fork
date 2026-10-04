/**
 * 外榜滚榜：复用 RankRollSystem，仅替换静态数据加载与本地队伍照片来源。
 */
class OutrankRollSystem extends RankRollSystem {
    constructor(containerId, config = {}) {
        const mergedConfig = RankToolMergeConfig({
            cache_duration: 60 * 1000,
            request_t_param: true,
            flg_show_export_offline_roll: false,
        }, config);
        super(containerId, mergedConfig);
        this.outrankUuid = String(mergedConfig.outrank_uuid || mergedConfig.cid_list || mergedConfig.key || 'default');
        this.teamPhotoStoreName = 'outrank_team_photos';
        this.outrankTeamPhotoMap = {};
        this.photoModalCreated = false;
    }

    async LoadData() {
        try {
            this.ShowLoading();
            this.data = await RankToolLoadStaticRankData(this);
            await this.LoadOutrankTeamPhotos();
            this.OriInit(this.data);
            this.HideLoading();
            this.isInitialLoad = false;
        } catch (error) {
            console.error('外榜滚榜数据加载错误:', error);
            this.ShowError('网络错误，请检查连接');
        }
    }

    GetExtraRollControlButtonsHtml(createRollButtonText) {
        return `
            <button id="outrank-team-photo-btn" class="control-btn with-text roll-control-btn roll-control-btn-outline-secondary">
                <i class="bi bi-images"></i>
                ${createRollButtonText('队伍照片', 'Team Photos')}
            </button>`;
    }

    bindEvents() {
        super.bindEvents();
        const photoBtn = document.querySelector('#outrank-team-photo-btn');
        if (photoBtn && !photoBtn.hasAttribute('data-outrank-photo-bound')) {
            photoBtn.setAttribute('data-outrank-photo-bound', 'true');
            photoBtn.addEventListener('click', () => this.OpenTeamPhotoModal());
        }
    }

    GetAwardTeamPhotoUrl(team_id) {
        const item = this.outrankTeamPhotoMap?.[team_id];
        return item && item.data_url ? item.data_url : '';
    }

    GetPhotoStoreKey() {
        return { outrank_uuid: this.outrankUuid };
    }

    async LoadOutrankTeamPhotos() {
        const saved = await window.idb.GetIdbTableByKey(this.teamPhotoStoreName, this.GetPhotoStoreKey());
        this.outrankTeamPhotoMap = saved && typeof saved === 'object' ? saved : {};
        return this.outrankTeamPhotoMap;
    }

    async SaveOutrankTeamPhotos() {
        await window.idb.SetIdbTableByKey(this.teamPhotoStoreName, this.GetPhotoStoreKey(), this.outrankTeamPhotoMap || {});
    }

    GetPhotoTeamList() {
        const teams = Object.values(this.teamMap || {});
        return teams
            .filter((team) => team && team.team_id && !team.privilege)
            .sort((a, b) => String(a.team_id).localeCompare(String(b.team_id), undefined, { numeric: true }));
    }

    CreateTeamPhotoModal() {
        if (this.photoModalCreated || !this.container) return;
        const modal = document.createElement('div');
        modal.id = 'outrank-team-photo-modal';
        modal.className = 'modal-overlay outrank-photo-overlay';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content outrank-photo-modal">
                <div class="modal-header">
                    <h3>${this.CreateBilingualText('外榜滚榜队伍照片', 'Outrank Roll Team Photos')}</h3>
                    <button id="outrank-team-photo-close" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="outrank-photo-summary" id="outrank-photo-summary"></div>
                    <div class="outrank-photo-list" id="outrank-photo-list"></div>
                </div>
            </div>`;
        this.container.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.CloseTeamPhotoModal();
            }
        });
        modal.querySelector('#outrank-team-photo-close').addEventListener('click', () => this.CloseTeamPhotoModal());
        this.photoModalCreated = true;
    }

    async OpenTeamPhotoModal() {
        await this.LoadOutrankTeamPhotos();
        this.CreateTeamPhotoModal();
        this.RenderTeamPhotoModal();
        const modal = this.container.querySelector('#outrank-team-photo-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    CloseTeamPhotoModal() {
        const modal = this.container.querySelector('#outrank-team-photo-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    RenderTeamPhotoModal() {
        const list = this.container.querySelector('#outrank-photo-list');
        const summary = this.container.querySelector('#outrank-photo-summary');
        if (!list || !summary) return;

        const teams = this.GetPhotoTeamList();
        const uploadedCount = teams.filter((team) => this.outrankTeamPhotoMap?.[team.team_id]?.data_url).length;
        summary.innerHTML = `
            <div class="outrank-photo-summary__main">
                <strong>${uploadedCount}</strong> / ${teams.length}
                <span class="en-text">Uploaded</span>
            </div>
            <div class="outrank-photo-summary__hint">
                照片只保存在当前浏览器 IndexedDB，不会上传到服务器。
                <span class="en-text">Photos are stored only in this browser's IndexedDB and are not uploaded.</span>
            </div>`;

        list.innerHTML = teams.map((team) => {
            const photo = this.outrankTeamPhotoMap?.[team.team_id];
            const hasPhoto = !!(photo && photo.data_url);
            return `
                <div class="outrank-photo-row" data-team-id="${RankToolEscapeHtml(team.team_id)}">
                    <div class="outrank-photo-preview">
                        ${hasPhoto
                            ? `<img src="${photo.data_url}" alt="${RankToolEscapeHtml(team.team_id)}">`
                            : '<span class="outrank-photo-empty">未上传<span class="en-text">No Photo</span></span>'}
                    </div>
                    <div class="outrank-photo-team">
                        <div class="outrank-photo-team-id">${RankToolEscapeHtml(team.team_id)}</div>
                        <div class="outrank-photo-team-name">${RankToolEscapeHtml(team.name || team.team_id)}</div>
                        <div class="outrank-photo-team-school">${RankToolEscapeHtml(team.school || '')}</div>
                    </div>
                    <div class="outrank-photo-actions">
                        <label class="btn btn-sm btn-outline-primary mb-0">
                            ${hasPhoto ? '覆盖' : '上传'}<span class="en-text">${hasPhoto ? 'Replace' : 'Upload'}</span>
                            <input class="outrank-photo-file" type="file" accept="image/*" hidden>
                        </label>
                        <button type="button" class="btn btn-sm btn-outline-danger outrank-photo-delete" ${hasPhoto ? '' : 'disabled'}>
                            删除<span class="en-text">Delete</span>
                        </button>
                    </div>
                </div>`;
        }).join('');

        list.querySelectorAll('.outrank-photo-file').forEach((input) => {
            input.addEventListener('change', (e) => this.HandlePhotoInputChange(e));
        });
        list.querySelectorAll('.outrank-photo-delete').forEach((btn) => {
            btn.addEventListener('click', (e) => this.HandlePhotoDelete(e));
        });
    }

    async HandlePhotoInputChange(e) {
        const input = e.currentTarget;
        const row = input.closest('.outrank-photo-row');
        const teamId = row ? row.getAttribute('data-team-id') : '';
        const file = input.files && input.files[0];
        if (!teamId || !file) return;
        try {
            const dataUrl = await this.ReadAndResizePhoto(file);
            this.outrankTeamPhotoMap[teamId] = {
                team_id: teamId,
                data_url: dataUrl,
                file_name: file.name,
                updated_at: Date.now(),
            };
            await this.SaveOutrankTeamPhotos();
            this.RenderTeamPhotoModal();
        } catch (error) {
            console.error('照片处理失败:', error);
            alerty.error({
                message: '照片处理失败，请更换图片后重试',
                message_en: 'Failed to process photo, please choose another image and try again',
            });
        } finally {
            input.value = '';
        }
    }

    async HandlePhotoDelete(e) {
        const row = e.currentTarget.closest('.outrank-photo-row');
        const teamId = row ? row.getAttribute('data-team-id') : '';
        if (!teamId) return;
        delete this.outrankTeamPhotoMap[teamId];
        await this.SaveOutrankTeamPhotos();
        this.RenderTeamPhotoModal();
    }

    ReadAndResizePhoto(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error || new Error('Read file failed'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('Invalid image'));
                img.onload = () => {
                    const maxWidth = 1600;
                    const maxHeight = 1000;
                    const ratio = Math.min(1, maxWidth / img.width, maxHeight / img.height);
                    const width = Math.max(1, Math.round(img.width * ratio));
                    const height = Math.max(1, Math.round(img.height * ratio));
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.86));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }
}

function OutrankRollSystemInit(containerId, config = {}) {
    if (!config || Object.keys(config).length === 0) {
        config = window.RANK_CONFIG || {};
    }
    return new OutrankRollSystem(containerId, config);
}

window.OutrankRollSystem = OutrankRollSystem;
window.OutrankRollSystemInit = OutrankRollSystemInit;
