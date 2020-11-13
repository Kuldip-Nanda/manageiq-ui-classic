require 'routing/shared_examples'

describe 'routes for MiqAlertController' do
  let(:controller_name) { 'miq_alert' }

  describe '#miq_alert_edit' do
    it 'routes with POST' do
      expect(post("/#{controller_name}/miq_alert_edit")).to route_to("#{controller_name}#miq_alert_edit")
    end
  end

  describe '#alert_field_changed' do
    it 'routes with POST' do
      expect(post("/#{controller_name}/alert_field_changed")).to route_to("#{controller_name}#alert_field_changed")
    end
  end

  describe '#x_button' do
    it 'routes with POST' do
      expect(post("/#{controller_name}/x_button")).to route_to("#{controller_name}#x_button")
    end
  end

  describe '#x_history' do
    it 'routes with POST' do
      expect(post("/#{controller_name}/x_history")).to route_to("#{controller_name}#x_history")
    end
  end

  describe '#x_show' do
    it 'routes with POST' do
      expect(post("/#{controller_name}/x_show")).to route_to("#{controller_name}#x_show")
    end
  end
end
