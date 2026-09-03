document.addEventListener("DOMContentLoaded", () => {
  const modal = document.querySelector(".modalWindow");
  const modalBg = document.querySelector(".modalBG");
  const modalTrigger = document.querySelectorAll(".popup");

  modal.querySelector("svg").addEventListener("click", () => {
    modalBg.classList.remove("modalOpen");
  });

  modalBg.addEventListener("click", () => {
    modalBg.classList.remove("modalOpen");
  });

  modal.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  modalTrigger.forEach((element) => {
    element.addEventListener("click", () => {
      modalBg.classList.add("modalOpen");
    });
  });

  const modal2 = document.querySelector(".modalWindow2");
  const modalBg2 = document.querySelector(".modalBG2");
  const modalTrigger2 = document.querySelectorAll(".popup2");

  modal2.querySelector("svg").addEventListener("click", () => {
    modalBg2.classList.remove("modalOpen");
  });

  modalBg2.addEventListener("click", () => {
    modalBg2.classList.remove("modalOpen");
  });

  modal2.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  modalTrigger2.forEach((element) => {
    element.addEventListener("click", () => {
      modalBg2.classList.add("modalOpen");
    });
  });

  const fileInput = document.getElementById("file-input");
  const addLabel = document.querySelector(".dragWindow label");
  const MAX_SIZE = 50 * 1024 * 1024; 
  const MAX_FILES = 5;
  const loadingFileLabels = document.querySelectorAll(".loadingFile");
  let currentFiles = [];

  const removeFileFromInput = (fileToRemove) => {
      const newDataTransfer = new DataTransfer();
      currentFiles.forEach(file => {
          if (file !== fileToRemove) {
              newDataTransfer.items.add(file);
          }
      });
      fileInput.files = newDataTransfer.files;
  };
  
  fileInput.addEventListener("change", function (event) {
      const files = event.target.files;
  
      if (currentFiles.length + files.length > MAX_FILES - 1) {
          addLabel.style.display = "none";
      }
      if (currentFiles.length + files.length > MAX_FILES) {
          alert(`Вы можете загрузить не более ${MAX_FILES} файлов.`);
          addLabel.style.display = "flex";
          return;
      }
  
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
  
          if (file.size > MAX_SIZE) {
              alert("Файл слишком большой: " + file.name);
              continue;
          }
  
          currentFiles.push(file);
          const loadingFileLabel = loadingFileLabels[currentFiles.length - 1];
          loadingFileLabel.style.display = "flex";
          const progressBar = loadingFileLabel.querySelector(".loadingFile__scrollBar");
          const progressContainer = loadingFileLabel.querySelector(".loadingFile__scrollContainer");
          const loadingFileName = loadingFileLabel.querySelector(".loadingFile__name");
          const removeButton = loadingFileLabel.querySelector(".loadingFile__close"); 
          const reader = new FileReader();
  
          loadingFileName.textContent = file.name;
  
          reader.onprogress = function (event) {
              if (event.lengthComputable) {
                  const percentComplete = (event.loaded / event.total) * 100;
                  progressBar.style.width = percentComplete + "%";
              }
          };
  
          reader.onload = function () {
              progressBar.style.width = "100%";
              progressContainer.style.display = "none";
          };
  
          reader.readAsArrayBuffer(file);
  
          removeButton.addEventListener("click", function () {
              const fileIndex = currentFiles.indexOf(file);
              if (fileIndex > -1) {
                  currentFiles.splice(fileIndex, 1);
                  removeFileFromInput(file); 
              }
              loadingFileLabel.style.display = "none";
              addLabel.style.display = "flex";
          });
      }
  });
  

  document.querySelector(".input-search").addEventListener("focus", () => {
    document.querySelector(".search").classList.add("searchFocus");
  });
  document.querySelector(".input-search").addEventListener("blur", () => {
    document.querySelector(".search").classList.remove("searchFocus");
  });

  const input = document.querySelector(".input-search");
  const searchList = document.querySelector(".search__list");
  let noResult = document.querySelector(".noResult");
  const searchClose = document.querySelector(".searchClose");
  let prop = document.querySelectorAll(".setting__property");
  const newColor = "#ebdec1";
  let resultH3 = document.querySelectorAll(".search__config h3");

  searchClose.addEventListener("click", () => {
    input.value = "";
    input.focus();
    searchClose.style.display = "none";
  });
  input.addEventListener("blur", function () {
    setTimeout(() => {
      searchList.style.display = "none";
      noResult.style.display = "none";
      this.value = "";
      searchList.innerHTML = '<span class="noResult">No result</span>';
    }, 200);
  });
  input.addEventListener("input", function () {
    if (this.value == "") {
      noResult.style.display = "block";
      searchList.style.display = "none";
      searchClose.style.display = "none";
    } else {
      noResult.style.display = "none";
      searchList.style.display = "block";
      searchProj(this.value, () => {
        resultH3 = document.querySelectorAll(".search__config h3");
        prop = document.querySelectorAll(".setting__property");

        const searchItem = document.querySelectorAll(".search__item");
        const searchTerm = input.value;
        const regex = new RegExp(searchTerm, "gi");

        resultH3.forEach((element) => {
          if (regex.test(element.textContent)) {
            const modifiedText = element.textContent.replace(
              regex,
              (match) =>
                `<span class="spYellow" style="background-color: ${newColor};">${match}</span>`
            );
            element.innerHTML = modifiedText;
            searchItem.forEach((el) => {
              el.style.display = "flex";
            });
            noResult.style.display = "none";
          } else {
            element.innerHTML = element.textContent;
          }
        });
        prop.forEach((element) => {
          if (regex.test(element.textContent)) {
            const modifiedText = element.textContent.replace(
              regex,
              (match) =>
                `<span class="spYellow" style="background-color: ${newColor};">${match}</span>`
            );
            element.innerHTML = modifiedText;
            searchItem.forEach((el) => {
              el.style.display = "flex";
            });
            noResult.style.display = "none";
          } else {
            element.innerHTML = element.textContent;
          }
        });
        if (searchList.querySelector(".spYellow") == null) {
          searchItem.forEach((el) => {
            el.style.display = "none";
          });
          noResult.style.display = "block";
        }
      });
      if (window.innerWidth <= 750) {
        searchClose.style.display = "block";
      }
    }
  });
  function searchProj(valSend, callback) {
    fetch("/wp-admin/admin-ajax.php?action=my_action", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ inputVal: valSend }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok " + response.statusText);
        }
        return response.json();
      })
      .then((data) => {
        searchList.innerHTML = '<span class="noResult">No result</span>';
        if (data && data.success && data.data.length > 0) {
          for (let i = 0; i < data.data.length; i++) {
            let tmp = "";
            const projectTypes = data.data[i].project_type_set;

            for (let j = 0; j < Math.floor(projectTypes.length / 2); j++) {
              tmp += `
                <span class="search__setting">
                  <span class="setting__name">${projectTypes[j * 2]}</span>
                  <span class="setting__property">${
                    projectTypes[j * 2 + 1]
                  }</span>
                </span>`;
            }

            searchList.innerHTML += `
              <a href="/#proj=${data.data[i].title}" class="search__item">
                <div class="search-img">
                  <img src="${data.data[i].minImg}" alt="${data.data[i].title}" />
                </div>
                <div class="search__config">
                  <h3>${data.data[i].title}</h3>
                  ${tmp} 
                </div>
              </a>`;
          }
        } else {
          searchList.innerHTML = '<span class="noResult">No result</span>';
          noResult = document.querySelector(".noResult");
          noResult.style.display = "block";
          searchClose.style.display = "none";
        }
        if (callback) callback();
      })
      .catch((error) => {
        console.error("An error occurred:", error);
      });
  }
});
  
