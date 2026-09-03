document.addEventListener('DOMContentLoaded', ()=>{
    try{
        const burger = document.querySelector('.burger'),
        burgerTop = burger.querySelector('.burgTop'),
        burgerCenter = burger.querySelector('.burgCenter'),
        burgerBottom = burger.querySelector('.burgBottom'),
        navAfter = document.querySelector('.nav__items'),
        navAfter2 = document.querySelector('.burMenuMob .nav__items'),
        burMenuMob = document.querySelector('.burMenuMob');
        
    let isOpen = false;
    
    burger.addEventListener('click', () => {
        navAfter.classList.toggle('navOpened');
    
        if (!isOpen) {
            burgerTop.classList.add('burgerTopAnim');
            burgerCenter.classList.add('burgerCenterAnim');
            burgerBottom.classList.add('burgerBottomAnim');
            burgerTop.classList.remove('burgerTopAnimReverse');
            burgerCenter.classList.remove('burgerCenterAnimReverse');
            burgerBottom.classList.remove('burgerBottomAnimReverse');
        } else {
            burgerTop.classList.remove('burgerTopAnim');
            burgerCenter.classList.remove('burgerCenterAnim');
            burgerBottom.classList.remove('burgerBottomAnim');
            burgerTop.classList.add('burgerTopAnimReverse');
            burgerCenter.classList.add('burgerCenterAnimReverse');
            burgerBottom.classList.add('burgerBottomAnimReverse');
        }
        isOpen = !isOpen;
    
    
        if (window.innerWidth <= 1180){
            burMenuMob.classList.toggle('burMenuMobTrans');
        }
    });
    
    const container = document.querySelector('.centerProject .container');
    const containerProjOne = document.querySelector('.currentProject');
    const containerProjTwo = document.querySelector('.currentProject2');
    const scrollButton = document.querySelector('.arrowUp');
    
    scrollButton.addEventListener('click', () => {
        try{
            console.log('Button clicked');
            if (!containerProjOne.classList.contains('project__openned') && !containerProjTwo.classList.contains('currentRight')) {
                console.log('Scrolling to container');
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if(containerProjOne.classList.contains('project__openned') && !containerProjTwo.classList.contains('currentRight')){
                console.log('Scrolling to containerProjOne');
                containerProjOne.querySelector('.currentProject_container').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }else{
                console.log('Scrolling to containerProjOne');
                containerProjTwo.querySelector('.currentProject_container').scrollIntoView({ behavior: 'smooth', block: 'start' });
        
            }

        }catch{}
    });
    
    
    const navItem = document.querySelectorAll('.nav__project_item a');
    const currentProject__closeBtn = document.querySelector('.currentProject__closeBtn');
    const navItemMobile = document.querySelectorAll('.nav__project_item');
    const allPodkat = document.querySelectorAll('.podkat');
    const allNavBtn = document.querySelectorAll('.residentialcommercial');
    navItem.forEach(element => {
        element.addEventListener('click', ()=>{
            try{
                for (let i = 0; i <= allPodkat.length - 1; i++){
                    allPodkat[i].classList.remove('navCurrHeight');
                }
                for (let i = 0; i <= allNavBtn.length - 1; i++){
                    allNavBtn[i].classList.remove('btnActive');
                }
                element.parentNode.querySelector('.podkat').classList.add('navCurrHeight');
                element.parentNode.querySelector('.podkat .residentialcommercial').classList.add('btnActive');
                currentProject__closeBtn.click();
            }catch{};
        });
    });
    if (window.innerWidth <= 1179){
        navItemMobile.forEach(element => {
            element.addEventListener('click', ()=>{
                try{
                    for (let i = 0; i <= allPodkat.length - 1; i++){
                        allPodkat[i].classList.remove('navCurrHeight');
                    }
                    for (let i = 0; i <= allNavBtn.length - 1; i++){
                        allNavBtn[i].classList.remove('btnActive');
                    }
                    element.nextElementSibling.classList.add('navCurrHeight');
                    element.nextElementSibling.querySelector('.residentialcommercial').classList.add('btnActive');
                }catch{};
            });
        });
    
    }
    allNavBtn.forEach(element => {
        element.addEventListener('click', ()=>{
            for (let i = 0; i <= allNavBtn.length - 1; i++){
                allNavBtn[i].classList.remove('btnActive');
            }
            element.classList.add('btnActive');
            currentProject__closeBtn.click();
        });
    });
    
    
    const viewVariantBtn = document.querySelectorAll('.viewVariantBtn');
    const projectItems = document.querySelectorAll('.project__item');
    viewVariantBtn[0].classList.add('curOpac');
    const Projects = document.querySelector(".centerProject .container");
    viewVariantBtn.forEach(element => {
        element.addEventListener('click', ()=>{
            viewVariantBtn[0].classList.add('curOpac');
            viewVariantBtn[1].classList.add('curOpac');
            element.classList.remove('curOpac');
            Projects.classList.toggle('currentGrid')
            projectItems.forEach(el => {
                el.classList.toggle('curMargin');
                el.querySelector('.project__item-img').classList.toggle('curImgHeigth');
            });
        });
    });
    }catch{}
    try{
        const scrollButton = document.querySelector('.arrowUp');
        scrollButton.addEventListener('click', () => {
                document.querySelector('body').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }catch{}
});