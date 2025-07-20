// グローバル変数
let map;
let drawnItems;
let drawControl;

// 地図の初期化
function initMap() {
    // 地図の作成（東京を中心に）
    map = L.map('map').setView([35.6762, 139.6503], 10);

    // OpenStreetMapタイルレイヤーを追加
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // 描画されたアイテムを保存するレイヤーグループ
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // 描画コントロールの設定
    drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            // ポリゴンのみ有効化
            polygon: {
                allowIntersection: false,
                showArea: true,
                drawError: {
                    color: '#e1e100',
                    message: '<strong>エラー:</strong> 線が交差しています！'
                },
                shapeOptions: {
                    color: '#3388ff',
                    weight: 3,
                    fillOpacity: 0.3
                }
            },
            rectangle: {
                shapeOptions: {
                    color: '#3388ff',
                    weight: 3,
                    fillOpacity: 0.3
                }
            },
            // その他は無効化
            polyline: false,
            circle: false,
            circlemarker: false,
            marker: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });
    map.addControl(drawControl);

    // 描画イベントのリスナー
    map.on(L.Draw.Event.CREATED, function(e) {
        const layer = e.layer;
        drawnItems.addLayer(layer);
        updatePolygonCount();
        showSuccessMessage('ポリゴンが追加されました！');
    });

    map.on(L.Draw.Event.EDITED, function(e) {
        updatePolygonCount();
        showSuccessMessage('ポリゴンが編集されました！');
    });

    map.on(L.Draw.Event.DELETED, function(e) {
        updatePolygonCount();
        showSuccessMessage('ポリゴンが削除されました！');
    });

    // 初期ポリゴン数を更新
    updatePolygonCount();
}

// ポリゴン数を更新
function updatePolygonCount() {
    const count = Object.keys(drawnItems._layers).length;
    document.getElementById('polygonCount').textContent = `ポリゴン数: ${count}`;
}

// 成功メッセージを表示
function showSuccessMessage(message) {
    // 簡単な通知を作成
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2ecc71;
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        z-index: 10000;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    // アニメーション CSS を追加
    if (!document.getElementById('notification-style')) {
        const style = document.createElement('style');
        style.id = 'notification-style';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // 3秒後に削除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// 全削除機能
function clearAllPolygons() {
    if (Object.keys(drawnItems._layers).length === 0) {
        alert('削除するポリゴンがありません。');
        return;
    }
    
    if (confirm('全てのポリゴンを削除しますか？')) {
        drawnItems.clearLayers();
        updatePolygonCount();
        showSuccessMessage('全てのポリゴンが削除されました！');
    }
}

// GeoJSONとしてポリゴンを取得
function getPolygonsAsGeoJSON() {
    const features = [];
    
    drawnItems.eachLayer(function(layer) {
        const feature = layer.toGeoJSON();
        // プロパティを追加
        feature.properties = {
            id: L.Util.stamp(layer),
            area: calculateArea(layer),
            created: new Date().toISOString()
        };
        features.push(feature);
    });
    
    return {
        type: "FeatureCollection",
        features: features
    };
}

// ポリゴンの面積を計算
function calculateArea(layer) {
    if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        const latlngs = layer.getLatLngs()[0];
        return L.GeometryUtil ? L.GeometryUtil.geodesicArea(latlngs) : 0;
    }
    return 0;
}

// ファイルをダウンロード
function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// GeoJSONで保存
function saveAsGeoJSON() {
    if (Object.keys(drawnItems._layers).length === 0) {
        alert('保存するポリゴンがありません。');
        return;
    }
    
    const geoJsonData = getPolygonsAsGeoJSON();
    const content = JSON.stringify(geoJsonData, null, 2);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `polygons_${timestamp}.geojson`;
    
    downloadFile(content, filename, 'application/json');
    showSuccessMessage('GeoJSONファイルが保存されました！');
}

// KMLで保存
function saveAsKML() {
    if (Object.keys(drawnItems._layers).length === 0) {
        alert('保存するポリゴンがありません。');
        return;
    }
    
    try {
        const geoJsonData = getPolygonsAsGeoJSON();
        const kmlContent = tokml(geoJsonData, {
            name: 'name',
            description: 'description',
            documentName: 'ポリゴンデータ',
            documentDescription: 'ポリゴン描画アプリで作成されたデータ'
        });
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `polygons_${timestamp}.kml`;
        
        downloadFile(kmlContent, filename, 'application/vnd.google-earth.kml+xml');
        showSuccessMessage('KMLファイルが保存されました！');
    } catch (error) {
        console.error('KML保存エラー:', error);
        alert('KMLファイルの保存中にエラーが発生しました。');
    }
}

// Shapefileで保存
function saveAsShapefile() {
    if (Object.keys(drawnItems._layers).length === 0) {
        alert('保存するポリゴンがありません。');
        return;
    }
    
    try {
        const geoJsonData = getPolygonsAsGeoJSON();
        
        // shp-writeライブラリを使用してShapefileを生成
        shpwrite.zip(geoJsonData, {
            folder: 'polygons',
            types: {
                polygon: 'polygons'
            }
        }).then(function(content) {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `polygons_${timestamp}.zip`;
            
            // Blobを作成してダウンロード
            const blob = new Blob([content], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            showSuccessMessage('Shapefileが保存されました！');
        }).catch(function(error) {
            console.error('Shapefile保存エラー:', error);
            alert('Shapefileの保存中にエラーが発生しました。');
        });
    } catch (error) {
        console.error('Shapefile保存エラー:', error);
        alert('Shapefileの保存中にエラーが発生しました。');
    }
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', function() {
    // 地図を初期化
    initMap();
    
    // ボタンイベントを設定
    document.getElementById('clearAll').addEventListener('click', clearAllPolygons);
    document.getElementById('saveGeoJSON').addEventListener('click', saveAsGeoJSON);
    document.getElementById('saveKML').addEventListener('click', saveAsKML);
    document.getElementById('saveShapefile').addEventListener('click', saveAsShapefile);
    
    console.log('ポリゴン描画アプリが正常に初期化されました！');
}); 