
PROGRAM _INIT
	(* No initialization needed - all configuration comes from gTrace.BufferUpload *)
END_PROGRAM

PROGRAM _CYCLIC
	(* CSV File Writing State Machine *)
	CASE fileStep OF
		0: (* Wait for trigger *)
			IF gTrace.CSVExport = CSV_REQUESTED THEN
				gTrace.CSVExport := CSV_PROCESSING;

				(* Generate dynamic filename from WorkID *)
				fileName := gTrace.BufferStatus.CurrentWorkID;
				brsstrcat(ADR(fileName), ADR('.csv'));

				fileStep := 10;
			END_IF;

		10: (* Delete existing file if it exists *)

			FDelete.enable  := TRUE;
			FDelete.pDevice := ADR(FILE_DEVICE);
			FDelete.pName   := ADR(fileName);
			FDelete();

			(* Status: 0=deleted successfully, 20708=file doesn't exist (both OK) *)
			IF (FDelete.status = 0) OR (FDelete.status = 20708) THEN
				fileStep := 20;
			ELSIF (FDelete.status <> 65535) THEN
				(* Real error occurred *)
				gTrace.CSVExport := CSV_ERROR;
				fileStep := 60;
			END_IF


		20: (* Create file *)
			fbFileCreate.enable := TRUE;
			fbFileCreate.pDevice := ADR(FILE_DEVICE);
			fbFileCreate.pFile := ADR(fileName);
			fbFileCreate();
			IF fbFileCreate.status = 0 THEN
				fbFileWrite.enable := TRUE;
				fbFileWrite.ident := fbFileCreate.ident;
				fbFileWrite.offset := 0;
				fbFileClose.enable := TRUE;
				fbFileClose.ident := fbFileCreate.ident;
				fileStep := 30;
			ELSIF fbFileCreate.status <> 65535 THEN
				(* Error creating file *)
				gTrace.CSVExport := CSV_ERROR;
				fileStep := 60;
			END_IF;

		30: (* Write CSV header and initialize pointer tracking *)
			(* Clear buffer *)
			brsmemset(ADR(fileBuffer), 0, SIZEOF(fileBuffer));

			(* Initialize pointer tracking *)
			StartAddress := ADR(fileBuffer);
			NextAddress := StartAddress;

			(* Write CSV header using pointer tracking *)
			NextAddress := brsstrcpy(NextAddress, ADR('index,xAxis,yAxis'));
			NextAddress := brsmemcpy(NextAddress, ADR(CRLF), SIZEOF(CRLF) - 1);

			(* Write header to file *)
			fbFileWrite.pSrc := StartAddress;
			fbFileWrite.len := NextAddress - StartAddress;
			fbFileWrite();
			IF fbFileWrite.status = 0 THEN
				fbFileWrite.offset := fbFileWrite.offset + fbFileWrite.len;

				(* Reset for data rows *)
				brsmemset(ADR(fileBuffer), 0, SIZEOF(fileBuffer));
				NextAddress := StartAddress;
				rowIndex := 0;
				fileStep := 40;
			ELSIF fbFileWrite.status <> 65535 THEN
				(* Error writing header *)
				gTrace.CSVExport := CSV_ERROR;
				fileStep := 50;
			END_IF;

		40: (* Fill buffer in batches - process multiple rows per cycle *)
			(* Process up to BATCH_SIZE rows per cycle *)
			FOR batchCounter := 0 TO (BATCH_SIZE - 1) DO
				(* Check if we have more rows to process *)
				IF rowIndex < gTrace.BufferUpload.BufferLength THEN
					(* Check buffer size before adding row - safety margin 200 bytes *)
					IF ((NextAddress - StartAddress) < (BUFFER_SIZE_LIMIT - 200)) THEN
						(* Add index *)
						NextAddress := NextAddress + brsitoa(rowIndex, NextAddress);

						(* Add delimiter *)
						NextAddress := brsmemcpy(NextAddress, ADR(','), SIZEOF(',') - 1);

						(* Add xAxis value *)
						NextAddress := NextAddress + brsftoa(gTrace.xAxis[rowIndex], NextAddress);

						(* Add delimiter *)
						NextAddress := brsmemcpy(NextAddress, ADR(','), SIZEOF(',') - 1);

						(* Add yAxis value *)
						NextAddress := NextAddress + brsftoa(gTrace.yAxis[rowIndex], NextAddress);

						(* Add line feed (CRLF) at END of row *)
						NextAddress := brsmemcpy(NextAddress, ADR(CRLF), SIZEOF(CRLF) - 1);

						(* Move to next row *)
						rowIndex := rowIndex + 1;
					ELSE
						(* Buffer is nearly full - exit loop and write to file *)
						EXIT;
					END_IF;
				ELSE
					(* All rows processed - exit loop *)
					EXIT;
				END_IF;
			END_FOR;

			(* After batch processing, check if we need to write buffer or continue *)
			IF ((NextAddress - StartAddress) >= (BUFFER_SIZE_LIMIT - 200)) OR (rowIndex >= gTrace.BufferUpload.BufferLength) THEN
				(* Buffer is full or all rows processed - write to file *)
				fileStep := 45;
			END_IF;

		45: (* Write buffer to file *)
			fbFileWrite.pSrc := StartAddress;
			fbFileWrite.len := NextAddress - StartAddress;
			fbFileWrite();
			IF fbFileWrite.status = 0 THEN
				fbFileWrite.offset := fbFileWrite.offset + fbFileWrite.len;
				fileStep := 46;
			ELSIF fbFileWrite.status <> 65535 THEN
				(* Error writing data *)
				gTrace.CSVExport := CSV_ERROR;
				fileStep := 50;
			END_IF;

		46: (* Check if more rows remain or finish *)
			IF rowIndex < gTrace.BufferUpload.BufferLength THEN
				(* More rows to process - reset buffer and continue *)
				brsmemset(ADR(fileBuffer), 0, SIZEOF(fileBuffer));
				NextAddress := StartAddress;
				fileStep := 40;
			ELSE
				(* All rows written - close file *)
				fileStep := 50;
			END_IF;

		50: (* Close file *)
			fbFileClose();
			IF fbFileClose.status = 0 THEN
				gTrace.CSVExport := CSV_COMPLETED;

				(* Update OPC UA status with CSV filename *)
				gTrace.BufferStatus.CSVFileName := fileName;

				fileStep := 60;
			ELSIF fbFileClose.status <> 65535 THEN
				(* Error closing file *)
				gTrace.CSVExport := CSV_ERROR;
				fileStep := 60;
			END_IF;

		60: (* Reset and return to idle *)
			fbFileCreate.enable := FALSE;
			fbFileWrite.enable := FALSE;
			fbFileClose.enable := FALSE;
			FDelete.enable := FALSE;
			fileStep := 0;
	END_CASE;
	 
END_PROGRAM

PROGRAM _EXIT
	(* Insert code here *)
	 
END_PROGRAM

