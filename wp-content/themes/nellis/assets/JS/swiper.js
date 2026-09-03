const swiper = new Swiper('.swiper', {
    slidesPerView: "auto",
    speed: 1000,
    spaceBetween: 20,
    breakpoints: {
        1179: {
            spaceBetween: 30,
        }
    },
    lazy: {
        loadPrevNext: true,
    },
    navigation: {
        nextEl: '.btnn',        
        prevEl: '.btnp',
    },  
   pagination: {
   el: '.swiper-paginationCust',
   type: 'fraction',
   },
});