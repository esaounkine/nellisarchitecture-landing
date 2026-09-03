(function() {
    'use strict';

    function addOverlay(img) {
        if (img.dataset.overlayAdded === 'true') return;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            position: relative;
            display: inline-block;
            line-height: 0;
            user-select: none;
            -webkit-user-select: none;
        `;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10;
            background: transparent;
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
        `;

        overlay.addEventListener('click', function(e) {
            img.click();
        });

        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);
        wrapper.appendChild(overlay);

        img.dataset.overlayAdded = 'true';
    }

    function protectImage(img) {
        if (img.dataset.protected === 'true') return;

        img.dataset.protected = 'true';

        img.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
        img.addEventListener('dragstart', function(e) {
            e.preventDefault();
            return false;
        });
        img.addEventListener('selectstart', function(e) {
            e.preventDefault();
            return false;
        });
        img.addEventListener('mousedown', function(e) {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                return false;
            }
        });

        img.style.userSelect = 'none';
        img.style.webkitUserSelect = 'none';
        img.style.webkitTouchCallout = 'none';
        img.style.draggable = 'false';
        img.setAttribute('draggable', 'false');
        img.setAttribute('oncontextmenu', 'return false;');
        img.setAttribute('ondragstart', 'return false;');

        if (img.complete && img.naturalWidth > 0) {
            addOverlay(img);
        } else {
            img.addEventListener('load', function() {
                addOverlay(img);
            });
            img.addEventListener('error', function() {
                addOverlay(img);
            });
        }
    }

    function protectAllImages() {
        const images = document.querySelectorAll('img:not([data-protected="true"])');
        images.forEach(protectImage);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', protectAllImages);
    } else {
        protectAllImages();
    }

    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeName === 'IMG') {
                    protectImage(node);
                }
                if (node.querySelectorAll) {
                    node.querySelectorAll('img:not([data-protected="true"])').forEach(protectImage);
                }
            });
            if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                const img = mutation.target;
                if (img.nodeName === 'IMG' && img.dataset.protected !== 'true') {
                    protectImage(img);
                }
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
    });


})();