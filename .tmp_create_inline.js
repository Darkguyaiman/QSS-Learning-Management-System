      // Wait for DOM to be fully loaded
      document.addEventListener('DOMContentLoaded', function() {
      // Dynamic option management
      const optionCContainer = document.getElementById('optionCContainer');
      const optionDContainer = document.getElementById('optionDContainer');
      const optionCInput = document.getElementById('optionC');
      const optionDInput = document.getElementById('optionD');
      const addOptionC = document.getElementById('addOptionC');
      const addOptionD = document.getElementById('addOptionD');
      const removeOptionC = document.getElementById('removeOptionC');
      const removeOptionD = document.getElementById('removeOptionD');
      const correctAnswerSelect = document.getElementById('correctAnswer');
      const correctAnswerC = document.getElementById('correctAnswerC');
      const correctAnswerD = document.getElementById('correctAnswerD');
      
      // Initialize: Hide option C and D by default
      if (optionCContainer) optionCContainer.style.display = 'none';
      if (optionDContainer) optionDContainer.style.display = 'none';
      if (addOptionC) addOptionC.style.display = 'inline-flex';
      if (addOptionD) addOptionD.style.display = 'inline-flex';
      if (removeOptionC) removeOptionC.style.display = 'none';
      if (removeOptionD) removeOptionD.style.display = 'none';
      
      function updateCorrectAnswerOptions() {
        const hasC = optionCContainer && optionCContainer.style.display !== 'none' && optionCInput && optionCInput.value.trim() !== '';
        const hasD = optionDContainer && optionDContainer.style.display !== 'none' && optionDInput && optionDInput.value.trim() !== '';
        
        if (correctAnswerC) {
          correctAnswerC.style.display = hasC ? 'block' : 'none';
        }
        if (correctAnswerD) {
          correctAnswerD.style.display = hasD ? 'block' : 'none';
        }
        
        // If current selection is C or D but option is removed, reset to empty
        if (correctAnswerSelect && correctAnswerSelect.value === 'C' && !hasC) {
          correctAnswerSelect.value = '';
        }
        if (correctAnswerSelect && correctAnswerSelect.value === 'D' && !hasD) {
          correctAnswerSelect.value = '';
        }
      }
      
      // Add Option C
      if (addOptionC) {
        addOptionC.addEventListener('click', function() {
          if (optionCContainer) optionCContainer.style.display = 'block';
          if (addOptionC) addOptionC.style.display = 'none';
          if (removeOptionC) removeOptionC.style.display = 'inline-flex';
          if (optionCInput) optionCInput.focus();
          updateCorrectAnswerOptions();
        });
      }
      
      // Remove Option C
      if (removeOptionC) {
        removeOptionC.addEventListener('click', function() {
          if (optionCContainer) optionCContainer.style.display = 'none';
          if (addOptionC) addOptionC.style.display = 'inline-flex';
          if (removeOptionC) removeOptionC.style.display = 'none';
          if (optionCInput) optionCInput.value = '';
          updateCorrectAnswerOptions();
        });
      }
      
      // Add Option D
      if (addOptionD) {
        addOptionD.addEventListener('click', function() {
          if (optionDContainer) optionDContainer.style.display = 'block';
          if (addOptionD) addOptionD.style.display = 'none';
          if (removeOptionD) removeOptionD.style.display = 'inline-flex';
          if (optionDInput) optionDInput.focus();
          updateCorrectAnswerOptions();
        });
      }
      
      // Remove Option D
      if (removeOptionD) {
        removeOptionD.addEventListener('click', function() {
          if (optionDContainer) optionDContainer.style.display = 'none';
          if (addOptionD) addOptionD.style.display = 'inline-flex';
          if (removeOptionD) removeOptionD.style.display = 'none';
          if (optionDInput) optionDInput.value = '';
          updateCorrectAnswerOptions();
        });
      }
      
      // Update correct answer options when option inputs change
      if (optionCInput) {
        optionCInput.addEventListener('input', updateCorrectAnswerOptions);
      }
      if (optionDInput) {
        optionDInput.addEventListener('input', updateCorrectAnswerOptions);
      }
      
      // Bulk upload functionality
      const uploadBulkBtn = document.getElementById('uploadBulkBtn');
      if (uploadBulkBtn) {
        uploadBulkBtn.addEventListener('click', function() {
          const bulkUploadInput = document.getElementById('bulkUploadInput');
          if (bulkUploadInput) {
            bulkUploadInput.click();
          }
        });
      }
      
      const bulkUploadInput = document.getElementById('bulkUploadInput');
      if (bulkUploadInput) {
        bulkUploadInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      // Show modal
      const modal = document.getElementById('bulkUploadModal');
      modal.classList.add('active');
      
      // Reset modal content
      const errorsDiv = document.getElementById('validationErrors');
      const successDiv = document.getElementById('validationSuccess');
      const uploadBtn = document.getElementById('uploadBtn');
      
      if (errorsDiv) {
        errorsDiv.innerHTML = '';
        errorsDiv.style.display = 'none';
      }
      if (successDiv) {
        successDiv.style.display = 'none';
      }
      if (uploadBtn) {
        uploadBtn.disabled = true;
      }
      
      // Read Excel file
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          // Use header: 1 to get array of arrays, and defval: '' for empty cells
          // Also use raw: false to get formatted values
          // Parse Excel with proper handling of empty cells
          // Use sheet_to_json with header: 1 to get array of arrays
          // The defval option ensures empty cells become empty strings
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
            header: 1, 
            defval: '',
            raw: false,
            blankrows: false
          });
          
          // Ensure all rows have at least 8 columns (A through H)
          // Pad rows that are shorter than expected - this fixes the issue where
          // empty cells cause array indices to not match column positions
          for (let i = 0; i < jsonData.length; i++) {
            if (!Array.isArray(jsonData[i])) {
              jsonData[i] = [];
            }
            while (jsonData[i].length < 9) {
              jsonData[i].push('');
            }
          }
          
          // Debug: Log first few rows to console
          console.log('Parsed Excel data (first 3 rows):', jsonData.slice(0, 3));
          console.log('Sheet range:', firstSheet['!ref']);
          
          // Validate data
          const validation = validateBulkData(jsonData);
          
          if (validation.errors.length > 0) {
            // Show errors
            if (errorsDiv) {
              errorsDiv.style.display = 'block';
              let errorsHtml = '<h3><i class="fas fa-exclamation-triangle"></i> Validation Errors</h3><ul>';
              validation.errors.forEach(error => {
                errorsHtml += `<li>${error}</li>`;
              });
              errorsHtml += '</ul>';
              errorsDiv.innerHTML = errorsHtml;
            }
            if (uploadBtn) {
              uploadBtn.disabled = true;
            }
          } else {
            // Show success
            if (successDiv) {
              successDiv.style.display = 'block';
              successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${validation.validCount} questions validated successfully. Ready to upload!`;
            }
            if (uploadBtn) {
              uploadBtn.disabled = false;
              uploadBtn.dataset.validData = JSON.stringify(validation.validData);
            }
          }
        } catch (error) {
          if (errorsDiv) {
            errorsDiv.style.display = 'block';
            errorsDiv.innerHTML = `<h3><i class="fas fa-exclamation-triangle"></i> Error</h3><ul><li>Failed to read Excel file: ${error.message}</li></ul>`;
          }
          if (uploadBtn) {
            uploadBtn.disabled = true;
          }
        }
      };
      reader.readAsArrayBuffer(file);
      });
      }
      
      // Validation function
      function validateBulkData(data) {
        const errors = [];
        const validData = [];
        const availableObjectives = window.availableObjectives || [];
        const availableDeviceModels = window.availableDeviceModels || [];
        
        // Skip header row (row 0) and start from row 1 (index 1)
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 2; // Excel row number (accounting for header row)
          
          // Check if row is empty
          if (!row || !Array.isArray(row) || row.every(cell => cell === null || cell === undefined || cell === '' || (typeof cell === 'string' && cell.trim() === ''))) {
            continue; // Skip empty rows
          }
          
          // Helper function to safely get cell value
          function getCellValue(index) {
            if (!row || !Array.isArray(row) || index >= row.length) return '';
            const value = row[index];
            if (value === null || value === undefined || value === '') return '';
            // Handle numbers and other types
            const strValue = String(value).trim();
            return strValue;
          }
          
          // Excel columns: A=Question, B=Test Type, C=Device Model, D=Objective, E=Option A, F=Option B, G=Option C, H=Option D, I=Correct Answer
          const question = getCellValue(0);
          const testType = getCellValue(1).toLowerCase();
          const deviceModel = getCellValue(2);
          const objective = getCellValue(3);
          const optionA = getCellValue(4);
          const optionB = getCellValue(5);
          const optionC = getCellValue(6);
          const optionD = getCellValue(7);
          const correctAnswer = getCellValue(8).toUpperCase();
          
          // Debug logging for first row with issues (only log once)
          if (i === 1 && (!optionA || !optionB)) {
            console.log('Row data:', row);
            console.log('Row length:', row.length);
            console.log('Parsed values:', { question, testType, objective, optionA, optionB, optionC, optionD, correctAnswer });
          }
          
          // Validate required fields
          if (!question) {
            errors.push(`Row ${rowNum}: Question is required`);
            continue;
          }
          
          if (!testType || !['pre_test', 'post_test', 'refresher_training', 'certificate_enrolment'].includes(testType)) {
            errors.push(`Row ${rowNum}: Test Type must be one of: pre_test, post_test, refresher_training, certificate_enrolment`);
            continue;
          }
          
          if (!objective) {
            errors.push(`Row ${rowNum}: Objective is required`);
            continue;
          }

          if (!deviceModel) {
            errors.push(`Row ${rowNum}: Device Model is required`);
            continue;
          }

          // Validate device model exists in system
          const deviceModelExists = availableDeviceModels.some(model => 
            model.toLowerCase() === deviceModel.toLowerCase()
          );
          if (!deviceModelExists) {
            errors.push(`Row ${rowNum}: Device Model "${deviceModel}" not found in system. Available device models: ${availableDeviceModels.join(', ')}`);
            continue;
          }
          
          // Validate objective exists in system
          const objectiveExists = availableObjectives.some(obj => 
            obj.toLowerCase() === objective.toLowerCase()
          );
          if (!objectiveExists) {
            errors.push(`Row ${rowNum}: Objective "${objective}" not found in system. Available objectives: ${availableObjectives.join(', ')}`);
            continue;
          }
          
          // Validate options A and B (required)
          // Check if the values are actually empty or just whitespace
          const optionAEmpty = !optionA || optionA === '' || (typeof optionA === 'string' && optionA.trim() === '');
          const optionBEmpty = !optionB || optionB === '' || (typeof optionB === 'string' && optionB.trim() === '');
          
          if (optionAEmpty) {
            // Enhanced error message with debugging info
            const debugInfo = `Row ${rowNum}: Option A is required (Column E). `;
            const valueInfo = `Value: "${optionA}" (type: ${typeof optionA}, length: ${optionA ? String(optionA).length : 0})`;
            const rowInfo = `Row array length: ${row.length}, Row[4]: ${row[4]}`;
            errors.push(debugInfo + valueInfo + '. ' + rowInfo);
            continue;
          }
          
          if (optionBEmpty) {
            // Enhanced error message with debugging info
            const debugInfo = `Row ${rowNum}: Option B is required (Column F). `;
            const valueInfo = `Value: "${optionB}" (type: ${typeof optionB}, length: ${optionB ? String(optionB).length : 0})`;
            const rowInfo = `Row array length: ${row.length}, Row[5]: ${row[5]}`;
            errors.push(debugInfo + valueInfo + '. ' + rowInfo);
            continue;
          }
          
          // Determine available options (C and D are optional)
          const hasOptionC = optionC && optionC.trim() !== '';
          const hasOptionD = optionD && optionD.trim() !== '';
          const availableOptions = ['A', 'B'];
          if (hasOptionC) availableOptions.push('C');
          if (hasOptionD) availableOptions.push('D');
          
          if (!correctAnswer || !availableOptions.includes(correctAnswer)) {
            errors.push(`Row ${rowNum}: Correct Answer must be one of: ${availableOptions.join(', ')}`);
            continue;
          }
          
          // Check for duplicate options
          const options = [optionA.trim(), optionB.trim()];
          if (hasOptionC) options.push(optionC.trim());
          if (hasOptionD) options.push(optionD.trim());
          const uniqueOptions = [...new Set(options.map(o => o.toLowerCase()))];
          if (uniqueOptions.length !== options.length) {
            errors.push(`Row ${rowNum}: Options must be unique (duplicate options found)`);
            continue;
          }
          
          // All validations passed
          validData.push({
            question_text: question,
            test_type: testType,
            device_model_name: deviceModel,
            objective_name: objective,
            option_a: optionA,
            option_b: optionB,
            option_c: hasOptionC ? optionC : null,
            option_d: hasOptionD ? optionD : null,
            correct_answer: correctAnswer
          });
        }
        
        return {
          errors,
          validData,
          validCount: validData.length
        };
      }
      
      // Set up modal event listeners
      // Close modal handlers for bulk upload modal
      const closeModal = document.getElementById('closeModal');
      if (closeModal) {
        closeModal.addEventListener('click', function() {
          const bulkModal = document.getElementById('bulkUploadModal');
          if (bulkModal) {
            bulkModal.classList.remove('active');
          }
          const bulkInput = document.getElementById('bulkUploadInput');
          if (bulkInput) {
            bulkInput.value = '';
          }
        });
      }
      
      const closeModal2 = document.getElementById('closeModal2');
      if (closeModal2) {
        closeModal2.addEventListener('click', function() {
          const bulkModal = document.getElementById('bulkUploadModal');
          if (bulkModal) {
            bulkModal.classList.remove('active');
          }
          const bulkInput = document.getElementById('bulkUploadInput');
          if (bulkInput) {
            bulkInput.value = '';
          }
        });
      }
      
      // Download template button - show modal first
      const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
      if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', function() {
          const templateModal = document.getElementById('templateModal');
          if (templateModal) {
            templateModal.classList.add('active');
          }
        });
      }
      
      // Close template modal
      const closeTemplateModal = document.getElementById('closeTemplateModal');
      if (closeTemplateModal) {
        closeTemplateModal.addEventListener('click', function() {
          const templateModal = document.getElementById('templateModal');
          if (templateModal) {
            templateModal.classList.remove('active');
          }
        });
      }
      
      const closeTemplateModal2 = document.getElementById('closeTemplateModal2');
      if (closeTemplateModal2) {
        closeTemplateModal2.addEventListener('click', function() {
          const templateModal = document.getElementById('templateModal');
          if (templateModal) {
            templateModal.classList.remove('active');
          }
        });
      }
      
      // Download template after showing modal
      const proceedDownloadBtn = document.getElementById('proceedDownloadBtn');
      if (proceedDownloadBtn) {
        proceedDownloadBtn.addEventListener('click', function() {
          window.location.href = '/questions/bulk/template';
          const templateModal = document.getElementById('templateModal');
          if (templateModal) {
            templateModal.classList.remove('active');
          }
        });
      }
      
      // Upload validated data
      const uploadBtn = document.getElementById('uploadBtn');
      if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
        const validData = JSON.parse(this.dataset.validData || '[]');
        if (validData.length === 0) {
          window.qssShowWarning && window.qssShowWarning('No valid data to upload', 'Upload Error');
          return;
        }
        
        // Show loading
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        
        // Send to server
        fetch('/questions/bulk/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ questions: validData })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            window.qssShowSuccess && window.qssShowSuccess(`Successfully uploaded ${data.inserted} questions!`, 'Uploaded');
            setTimeout(function() { window.location.href = '/questions'; }, 600);
          } else {
          TailwindModal.error('Upload Failed', 'Upload failed: ' + (data.error || 'Unknown error'));
            const errorsDiv = document.getElementById('validationErrors');
            if (errorsDiv) {
              errorsDiv.style.display = 'block';
              let errorsHtml = '<h3><i class="fas fa-exclamation-triangle"></i> Upload Errors</h3><ul>';
              if (data.errors && data.errors.length > 0) {
                data.errors.forEach(error => {
                  errorsHtml += `<li>${error}</li>`;
                });
              } else {
                errorsHtml += `<li>${data.error || 'Unknown error'}</li>`;
              }
              errorsHtml += '</ul>';
              errorsDiv.innerHTML = errorsHtml;
            }
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-upload"></i> Upload Questions';
          }
        })
        .catch(error => {
          TailwindModal.error('Upload Failed', 'Upload failed: ' + error.message);
          this.disabled = false;
          this.innerHTML = '<i class="fas fa-upload"></i> Upload Questions';
        });
      });
      }
    
    // ---- TailwindDropdown for Test Type ----
    new TailwindDropdown('testTypeDropdown', {
      items: [
        { label: 'Pre-Test',              value: 'pre_test' },
        { label: 'Post-Test',             value: 'post_test' },
        { label: 'Refresher Training Test',      value: 'refresher_training' },
        { label: 'Certificate Enrolment Test', value: 'certificate_enrolment' }
      ],
      placeholder: 'Select test type',
      multiSelect: false,
      onChange: function(val) {
        document.getElementById('testType').value = val || '';
      }
    });

    // ---- TailwindDropdown for Objective ----
    var objectiveItems = [];
    document.querySelectorAll('#objectiveId option').forEach(function(opt) {
      if (opt.value) objectiveItems.push({ label: opt.textContent.trim(), value: opt.value });
    });
    new TailwindDropdown('objectiveDropdown', {
      items: objectiveItems,
      placeholder: 'Select objective',
      multiSelect: false,
      onChange: function(val) {
        document.getElementById('objectiveId').value = val || '';
      }
    });

    // ---- TailwindDropdown for Device Model ----
    var deviceModelItems = [];
    document.querySelectorAll('#deviceModelId option').forEach(function(opt) {
      if (opt.value) deviceModelItems.push({ label: opt.textContent.trim(), value: opt.value });
    });
    new TailwindDropdown('deviceModelDropdown', {
      items: deviceModelItems,
      placeholder: 'Select device model',
      multiSelect: false,
      onChange: function(val) {
        document.getElementById('deviceModelId').value = val || '';
      }
    });
  });
