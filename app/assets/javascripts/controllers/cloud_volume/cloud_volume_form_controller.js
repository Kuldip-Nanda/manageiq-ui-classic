ManageIQ.angular.app.controller('cloudVolumeFormController', ['miqService', 'API', 'cloudVolumeFormId', 'cloudVolumeFormOperation', 'storageManagerId', '$q', function(miqService, API, cloudVolumeFormId, cloudVolumeFormOperation, storageManagerId, $q) {
  var vm = this;

  var init = function() {
    vm.afterGet = false;

    vm.cloudVolumeModel = {
      name: '',
      aws_encryption: false,
      incremental: false,
      force: false,
      storage_manager_id: storageManagerId,
    };

    vm.formId = cloudVolumeFormId;
    vm.model = "cloudVolumeModel";

    ManageIQ.angular.scope = vm;
    vm.saveable = miqService.saveable;

    vm.newRecord = cloudVolumeFormId === 'new';

    miqService.sparkleOn();

    // Load initial API data depending on what form we're displaying. Do as little requests as possible
    // to support fine-grained API permissions.
    var apiPromises = [];
    switch (cloudVolumeFormOperation) {
      case 'EDIT':
        // Fetch relevant StorageManager, just enough to populate the disabled drop-down.
        apiPromises.push(API.get('/api/providers/' + storageManagerId + '?attributes=id,name')
          .then(getStorageManagers));
        // Limit form options as permitted by this StorageManager.
        apiPromises.push(vm.storageManagerChanged(storageManagerId));
        // Fetch the volume.
        apiPromises.push(loadVolume(cloudVolumeFormId));
        break;
      case 'NEW':
        // Fetch StorageManagers that we can even create the new volume for.
        apiPromises.push(API.get('/api/providers?expand=resources&attributes=id,name,supports_block_storage&filter[]=supports_block_storage=true')
          .then(getStorageManagers));
        break;
      default:
        // Fetch the volume.
        apiPromises.push(loadVolume(cloudVolumeFormId));
    }

    // After all the API data is at hand we show the form.
    $q.all(apiPromises).then(setForm).catch(miqService.handleFailure);
  };

  vm.addClicked = function() {
    var url = 'create/new' + '?button=add';
    miqService.miqAjaxButton(url, vm.cloudVolumeModel, { complete: false });
  };

  vm.cancelClicked = function() {
    if (cloudVolumeFormId == 'new') {
      var url = '/cloud_volume/create/new' + '?button=cancel';
    } else {
      var url = '/cloud_volume/update/' + cloudVolumeFormId + '?button=cancel';
    }
    miqService.miqAjaxButton(url);
  };

  vm.saveClicked = function() {
    var url = '/cloud_volume/update/' + cloudVolumeFormId + '?button=save';
    miqService.miqAjaxButton(url, vm.cloudVolumeModel, { complete: false });
  };

  vm.attachClicked = function() {
    var url = '/cloud_volume/attach_volume/' + cloudVolumeFormId + '?button=attach';
    miqService.miqAjaxButton(url, vm.cloudVolumeModel, { complete: false });
  };

  vm.detachClicked = function() {
    var url = '/cloud_volume/detach_volume/' + cloudVolumeFormId + '?button=detach';
    miqService.miqAjaxButton(url, vm.cloudVolumeModel, { complete: false });
  };

  vm.cancelAttachClicked = function() {
    miqService.sparkleOn();
    var url = '/cloud_volume/attach_volume/' + cloudVolumeFormId + '?button=cancel';
    miqService.miqAjaxButton(url);
  };

  vm.cancelDetachClicked = function() {
    var url = '/cloud_volume/detach_volume/' + cloudVolumeFormId + '?button=cancel';
    miqService.miqAjaxButton(url);
  };

  vm.backupCreateClicked = function() {
    var url = '/cloud_volume/backup_create/' + cloudVolumeFormId + '?button=create';
    miqService.miqAjaxButton(url, vm.cloudVolumeModel, { complete: false });
  };

  vm.cancelBackupCreateClicked = function() {
    var url = '/cloud_volume/backup_create/' + cloudVolumeFormId + '?button=cancel';
    miqService.miqAjaxButton(url);
  };

  vm.backupRestoreClicked = function() {
    var url = '/cloud_volume/backup_restore/' + cloudVolumeFormId + '?button=restore';
    miqService.miqAjaxButton(url, vm.cloudVolumeModel, { complete: false });
  };

  vm.cancelBackupRestoreClicked = function() {
    var url = '/cloud_volume/backup_restore/' + cloudVolumeFormId + '?button=cancel';
    miqService.miqAjaxButton(url);
  };

  vm.snapshotCreateClicked = function() {
    var url = '/cloud_volume/snapshot_create/' + cloudVolumeFormId + '?button=create';
    miqService.miqAjaxButton(url, vm.cloudVolumeModel, { complete: false });
  };

  vm.cancelSnapshotCreateClicked = function() {
    var url = '/cloud_volume/snapshot_create/' + cloudVolumeFormId + '?button=cancel';
    miqService.miqAjaxButton(url);
  };

  vm.resetClicked = function(angularForm) {
    vm.cloudVolumeModel = angular.copy(vm.modelCopy);
    angularForm.$setPristine(true);
    miqService.miqFlash("warn", "All changes have been reset");
  };

  vm.storageManagerChanged = function(id) {
    miqService.sparkleOn();
    API.get('/api/providers/' + id + '?attributes=type,parent_manager.availability_zones,parent_manager.cloud_tenants')
      .then(getStorageManagerFormData)
      .catch(miqService.handleFailure);
  };

  vm.sizeChanged = function(size) {
    // Dynamically update the AWS IOPS only if GP2 volume type is selected.
    if (vm.cloudVolumeModel.aws_volume_type === 'gp2') {
      var volumeSize = parseInt(size, 10);

      if (isNaN(volumeSize)) {
        vm.cloudVolumeModel.aws_iops = null;
      } else {
        vm.cloudVolumeModel.aws_iops = Math.max(100, Math.min(volumeSize * 3, 10000));
      }
    }
  };

  vm.awsVolumeTypeChanged = function(voltype) {
    // The requested number of I/O operations per second that the volume can
    // support. For Provisioned IOPS (SSD) volumes, you can provision up to 50
    // IOPS per GiB. For General Purpose (SSD) volumes, baseline performance is
    // 3 IOPS per GiB, with a minimum of 100 IOPS and a maximum of 10000 IOPS.
    // General Purpose (SSD) volumes under 1000 GiB can burst up to 3000 IOPS

    switch (voltype) {
      case "gp2":
      case "io1":
        var volumeSize = parseInt(vm.cloudVolumeModel.size, 10);
        if (isNaN(volumeSize)) {
          vm.cloudVolumeModel.aws_iops = '';
        } else if (voltype === 'gp2') {
          vm.cloudVolumeModel.aws_iops = Math.max(100, Math.min(volumeSize * 3, 10000));
        } else {
          // Default ratio is 50 IOPS per 1 GiB. 20000 IOPS is the max.
          vm.cloudVolumeModel.aws_iops = Math.min(volumeSize * 50, 20000);
        }
        break;

      default:
        vm.cloudVolumeModel.aws_iops = 'Not Applicable';
        break;
    }
  };

  vm.canModifyVolumeSize = function() {
    // Volume size can be modified when adding a new cloud volume or when
    // editin Amazon EBS volume whose type is not magnetic (all other volume types
    // can be resized on the fly).
    return vm.newRecord ||
      (vm.cloudVolumeModel.emstype === 'ManageIQ::Providers::Amazon::StorageManager::Ebs' &&
        vm.cloudVolumeModel.aws_volume_type !== 'standard');
  };

  function setForm() {
    loadEBSVolumeTypes();

    vm.modelCopy = angular.copy(vm.cloudVolumeModel);
    vm.afterGet = true;
    miqService.sparkleOff();
  }

  var loadVolume = function(id) {
    return API.get('/api/cloud_volumes/' + id + '?attributes=ext_management_system.type,availability_zone.ems_ref,base_snapshot.ems_ref')
      .then(getCloudVolumeFormData)
  };

  var loadEBSVolumeTypes = function() {
    // This ia a fixed list of available cloud volume types for Amazon EBS.
    vm.awsVolumeTypes = [
      { type: "gp2", name: "General Purpose SSD (GP2)" },
      { type: "io1", name: "Provisioned IOPS SSD (IO1)" },
      { type: "st1", name: "Throughput Optimized HDD (ST1)" },
      { type: "sc1", name: "Cold HDD (SC1)" },
    ];

    // Standard volume type is available only when creating new volume or editing
    // an existing standard volume. In the latter case, it is only available so
    // that the "Magnetic (standard)" option can be picked in the select that is
    // otherwise disabled.
    if (vm.newRecord || vm.cloudVolumeModel.aws_volume_type === 'standard') {
      vm.awsVolumeTypes.push({ type: "standard", name: "Magnetic" });
    }
  };

  var getStorageManagers = function(data) {
    // Can handle list of all managers or a single manager.
    vm.storageManagers = data.resources ? data.resources : [data];
  };

  var getCloudVolumeFormData = function(data) {
    vm.cloudVolumeModel.emstype = data.ext_management_system.type;
    vm.cloudVolumeModel.name = data.name;
    // We have to display size in GB.
    vm.cloudVolumeModel.size = data.size / 1073741824;
    vm.cloudVolumeModel.cloud_tenant_id = data.cloud_tenant_id;
    // Currently, this is only relevant for AWS volumes so we are prefixing the
    // model attribute with AWS.
    vm.cloudVolumeModel.aws_volume_type = data.volume_type;
    vm.cloudVolumeModel.aws_availability_zone_id = data.availability_zone.ems_ref;

    // Update the IOPS based on the current volume size.
    vm.sizeChanged(vm.cloudVolumeModel.size);
  };

  var getStorageManagerFormData = function(data) {
    vm.cloudVolumeModel.emstype = data.type;
    vm.cloudTenantChoices = data.parent_manager.cloud_tenants;
    vm.availabilityZoneChoices = data.parent_manager.availability_zones;

    miqService.sparkleOff();
  };

  init();
}]);
