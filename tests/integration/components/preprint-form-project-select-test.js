import { moduleForComponent, test, skip } from 'ember-qunit';

import Permissions from 'ember-osf/const/permissions';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('preprint-form-project-select', 'Integration | Component | preprint form project select', {
    integration: true,
    beforeEach() {
        const noop = () => {};
        this.set('noop', noop);
    },
});

test('it renders', function(assert) {
    this.render(hbs`{{preprint-form-project-select
        changeInitialState=(action noop)
        finishUpload=(action noop)
        highlightSuccessOrFailure=(action noop)
    }}`);
    assert.equal(this.$('p.text-muted').text().trim(), 'The list of projects appearing in the selector are projects and components for which you have admin access.');
});

test('isNodeAdmin computed to false shows warning', function(assert) {
    this.set('selectedNode', {
        currentUserPermissions: [Permissions.ADMIN],
    });
    this.render(hbs`{{preprint-form-project-select
            changeInitialState=(action noop)
            finishUpload=(action noop)
            selectedNode=selectedNode
            isNodeAdmin=true
            preprintLocked=true
            currentState='existing'
            highlightSuccessOrFailure=(action noop)
        }}`);
    assert.ok(!this.$('.alert-danger').length);

    this.set('selectedNode', {
        currentUserPermissions: [],
    });
    this.render(hbs`{{preprint-form-project-select
        changeInitialState=(action noop)
        finishUpload=(action noop)
        selectedNode=selectedNode
        preprintLocked=true
        isNodeAdmin=false
        currentState='existing'
        highlightSuccessOrFailure=(action noop)
    }}`);
    assert.ok(this.$('.alert-danger').length);
});

skip('choosing a project locks the node', function() {
    // TODO: Needs factories to work properly, as do more tests checking the changing
    // states in this component, dependant on https://github.com/CenterForOpenScience/ember-preprints/pull/293/files
    test('choosing a project locks the node', function(assert) {
        this.render(hbs`{{preprint-form-project-select
            changeInitialState=(action noop)
            finishUpload=(action noop)
            userNodesLoaded=true
            userNodes=userNodes
            highlightSuccessOrFailure=(action noop)
        }}`);
        assert.ok(this.$());
    });
});
